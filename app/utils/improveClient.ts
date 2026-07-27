// AI 资产管理浏览器端客户端
//
// 所有调用走 Next.js 自家代理路由 /api/improve/*，由代理层注入后端 admin key + X-Actor。
// 浏览器永远不直接接触后端 IMPROVE_API_KEY。
//
// 用法：
//   import { improveClient } from '@/app/utils/improveClient'
//   const lessons = await improveClient.listLessons({ skill: 'helm_*' })
//   await improveClient.approveProposal(id)

import type {
  ImproveResponse,
  Lesson,
  ProposedLesson,
  Outcome,
  OutcomeStats,
  SkillPatchProposal,
  SkillSummary,
  SkillDetail,
  SkillSourceResponse,
  MemoryListResponse,
  MemoryEntriesListResponse,
  SkillDryRunResponse,
  ReflectStatus,
  EffectivenessReport,
  LessonsEffectivenessBatchResponse,
  LessonSeverity,
  MemoryType,
} from '../types/improve'

const BASE = '/api/improve'

/** 把 query 参数转 string；null/undefined/'' 自动跳过。 */
function buildQuery(params: Record<string, any>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue
    usp.append(k, String(v))
  }
  const s = usp.toString()
  return s ? '?' + s : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  })
  let body: ImproveResponse<T>
  try {
    body = await resp.json()
  } catch {
    throw new Error(`后端响应非 JSON：HTTP ${resp.status}`)
  }
  if (!resp.ok || !body.success) {
    const msg = body.error || `HTTP ${resp.status}`
    const err = new Error(msg) as Error & { code?: string; status?: number }
    err.code = body.code
    err.status = resp.status
    throw err
  }
  return body.data as T
}

export const improveClient = {
  // ---- Lessons ----

  async listLessons(params: {
    skill?: string
    cluster?: string
    project?: string
    q?: string
    top_k?: number
  } = {}): Promise<{ count: number; lessons: Lesson[] }> {
    return request(`/lessons${buildQuery(params)}`)
  },

  async getLesson(id: string): Promise<Lesson> {
    return request(`/lessons/${encodeURIComponent(id)}`)
  },

  async createLesson(input: {
    skill_pattern?: string
    args_signature?: string
    trigger?: string
    text: string
    severity?: LessonSeverity
    scope_project?: string
    scope_cluster?: string
  }): Promise<Lesson> {
    return request('/lessons', { method: 'POST', body: JSON.stringify(input) })
  },

  async deleteLesson(id: string): Promise<{ deleted: string }> {
    return request(`/lessons/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  async reEmbedLessons(input: {
    base_url: string
    api_key?: string
    model: string
  }): Promise<{ recomputed: number; skipped: number; model: string }> {
    return request('/lessons/re-embed', { method: 'POST', body: JSON.stringify(input) })
  },

  // ---- Proposed ----

  async listProposed(
    status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'
  ): Promise<{ count: number; status: string; proposed: ProposedLesson[] }> {
    return request(`/proposed${buildQuery({ status })}`)
  },

  async approveProposal(
    id: string,
    reason?: string
  ): Promise<{ approved: string; lesson: Lesson; approved_by: string }> {
    return request(`/proposed/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    })
  },

  async rejectProposal(
    id: string,
    reason: string
  ): Promise<{ rejected: string; reason: string; rejected_by: string }> {
    return request(`/proposed/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  },

  async triggerReflect(input: {
    since_seconds?: number
    min_failures?: number
    use_llm?: boolean
    llm_provider?: string
    llm_base_url?: string
    llm_api_key?: string
    llm_model?: string
  } = {}): Promise<{
    added: number
    skipped: number
    pending_total: number
    min_failures: number
    since_seconds: number
    used_llm?: boolean
  }> {
    return request('/reflect', { method: 'POST', body: JSON.stringify(input) })
  },

  // ---- Patches ----

  async listPatches(): Promise<{ count: number; patches: SkillPatchProposal[] }> {
    return request('/patches')
  },

  async getPatch(id: string): Promise<SkillPatchProposal> {
    return request(`/patches/${encodeURIComponent(id)}`)
  },

  async proposePatches(input: {
    min_failures?: number
    window_days?: number
  } = {}): Promise<{ proposed: number; patches: SkillPatchProposal[] }> {
    return request('/patches/propose', { method: 'POST', body: JSON.stringify(input) })
  },

  // ---- Outcomes ----

  async listOutcomes(params: {
    since_seconds?: number
    skill?: string
    status?: string
    limit?: number
  } = {}): Promise<{
    count: number
    limit: number
    since_seconds: number
    outcomes: Outcome[]
  }> {
    return request(`/outcomes${buildQuery(params)}`)
  },

  async getOutcomeStats(
    sinceSeconds = 24 * 3600
  ): Promise<OutcomeStats> {
    return request(`/outcomes/stats${buildQuery({ since_seconds: sinceSeconds })}`)
  },

  // ---- Skills ----

  async listSkills(params: {
    category?: string
    search?: string
  } = {}): Promise<{ count: number; skills: SkillSummary[] }> {
    return request(`/skills${buildQuery(params)}`)
  },

  async getSkill(name: string): Promise<SkillDetail> {
    return request(`/skills/${encodeURIComponent(name)}`)
  },

  /** 获取 file skill 的原始 YAML 源码（builtin → 422） */
  async getSkillSource(name: string): Promise<SkillSourceResponse> {
    return request(`/skills/${encodeURIComponent(name)}/source`)
  },

  /**
   * 写回 file skill 源码 + 触发 reload。
   * 后端做严格校验：单 skill / name 锁定 / schema 校验 / 原子写。
   * 返回 { name, source_file, bytes, note }；失败 throw Error（携带 code/status）。
   */
  async updateSkillSource(
    name: string,
    content: string
  ): Promise<{ name: string; source_file: string; bytes: number; note?: string }> {
    return request(`/skills/${encodeURIComponent(name)}/source`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
  },

  /**
   * 新建 file skill。
   * 后端会在 --skills-dir 下创建 {name}.md，校验内容、原子写、热重载。
   * 撞名 / 不合法 / skills-dir 未配置都会返回明确错误。
   */
  async createSkill(
    name: string,
    content: string
  ): Promise<{ name: string; source_file: string; bytes: number }> {
    return request(`/skills`, {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    })
  },

  // ---- Memory ----

  async listMemory(params: {
    type?: MemoryType
    project?: string
    cluster?: string
  } = {}): Promise<MemoryListResponse> {
    return request(`/memory${buildQuery(params)}`)
  },

  async createMemory(input: {
    content: string
    type?: MemoryType
    project?: string
    cluster?: string
  }): Promise<{ content: string; type: string; project?: string; cluster?: string; actor: string }> {
    return request('/memory', { method: 'POST', body: JSON.stringify(input) })
  },

  /** entry-level 列表（含 stable ID） */
  async listMemoryEntries(params: {
    type?: MemoryType
    project?: string
    cluster?: string
  } = {}): Promise<MemoryEntriesListResponse> {
    return request(`/memory/entries${buildQuery(params)}`)
  },

  /** 按 ID 删除单条 */
  async deleteMemoryEntry(id: string): Promise<{ deleted: string }> {
    return request(`/memory/entries/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  /** Skill dry-run：渲染命令但不执行 */
  async dryRunSkill(
    name: string,
    args: Record<string, any>
  ): Promise<SkillDryRunResponse> {
    return request(`/skills/${encodeURIComponent(name)}/dry-run`, {
      method: 'POST',
      body: JSON.stringify({ args }),
    })
  },

  /** 拉自动定时反思的最新状态 */
  async getReflectStatus(): Promise<ReflectStatus> {
    return request('/reflect/status')
  },

  /** 度量一条 lesson 入库后是否真减少了相关 skill 失败 */
  async getLessonEffectiveness(
    id: string,
    baselineDays = 7
  ): Promise<EffectivenessReport> {
    return request(
      `/lessons/${encodeURIComponent(id)}/effectiveness${buildQuery({ baseline_days: baselineDays })}`
    )
  },

  /** 批量拉所有 lesson 的效果度量（列表页用，避免 N+1） */
  async getAllLessonsEffectiveness(
    baselineDays = 7
  ): Promise<LessonsEffectivenessBatchResponse> {
    return request(
      `/lessons/effectiveness${buildQuery({ baseline_days: baselineDays })}`
    )
  },
}
