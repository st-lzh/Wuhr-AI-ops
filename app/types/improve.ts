// AI 资产管理（self-improving lesson loop）类型定义
//
// 与后端 pkg/improve 包字段对齐；变更后端结构时同步更新这里。
//
// 设计原则：每条响应都走 { success, data, error?, code? } 外壳，data 是 endpoint 特定结构。

export type LessonSeverity = 'info' | 'warn' | 'critical'
export type LessonSource = 'user' | 'auto-reflection' | 'skill-failure' | 'skill-patch'
export type OutcomeStatus = 'success' | 'failure' | 'error' | 'skipped'
export type ProposedStatus = 'pending' | 'approved' | 'rejected'
export type MemoryType = 'reference' | 'feedback' | 'project' | 'user' | ''

/** Lesson 教训条目（已批准、可被检索） */
export interface Lesson {
  id: string
  created_at: string
  updated_at?: string
  skill_pattern?: string
  args_signature?: string
  trigger?: string
  text: string
  severity: LessonSeverity
  source: LessonSource
  scope_project?: string
  scope_cluster?: string
  usage_count?: number
  embedding_model?: string
  embedding_dim?: number  // 详情接口才返回，不含具体向量值
}

/** 待审批提案 */
export interface ProposedLesson {
  id: string
  proposed_at: string
  status: ProposedStatus
  source: LessonSource
  skill_pattern?: string
  args_signature?: string
  trigger?: string
  text: string
  severity: LessonSeverity
  scope_project?: string
  scope_cluster?: string
  evidence_outcome_ids?: string[]
  approved_at?: string
  approved_by?: string
  rejected_at?: string
  rejected_by?: string
  reject_reason?: string
}

/** Outcome 一次 skill 执行结果 */
export interface Outcome {
  timestamp: string
  session_id?: string
  actor?: string
  skill_name: string
  args_signature: string
  args?: Record<string, any>
  exit_code: number
  dry_run?: boolean
  skipped?: boolean
  stderr_tail?: string
  stdout_tail?: string
  error?: string
  status: OutcomeStatus
  duration_ms?: number
}

/** Outcomes 聚合统计 */
export interface OutcomeStats {
  since_seconds: number
  total: number
  success: number
  failure: number
  error: number
  skipped: number
  avg_ms: number
  by_status: Record<string, number>
  top_skills: Array<{ name: string; count: number }>
}

/** SkillPatchProposal 自动补丁建议 */
export interface SkillPatchProposal {
  id: string
  proposed_at: string
  skill_name: string
  args_signature: string
  failure_count: number
  window_days: number
  example_stderrs?: string[]
  example_exit_codes?: number[]
  failure_category: string
  suggested_changes: SuggestedChange[]
  evidence_outcome_ids?: string[]
}

export interface SuggestedChange {
  field: string
  operation: string
  rationale: string
  suggestion: string
}

/** Skill 摘要（列表项） */
export interface SkillSummary {
  name: string
  description: string
  category: string
  tags?: string[]
  is_builtin: boolean
  approval_policy?: string
  risk_override?: string
  idempotent?: boolean
  executor_type?: string
  version?: string
  param_count: number
  has_check: boolean
  pre_hooks: number
  post_hooks: number
  on_failure: number
}

/** Skill 源文件原始内容（仅 file skill 可读） */
export interface SkillSourceResponse {
  name: string
  source_file: string
  content: string
  size_bytes: number
}

/** Skill 详情（含 executor 源码） */
export interface SkillDetail extends SkillSummary {
  parameters?: any[]
  executor?: any
  check?: any
  pre_hooks_detail?: any[]
  post_hooks_detail?: any[]
  on_failure_detail?: any[]
  outputs?: any[]
}

/** Memory 列表响应（content 是合并后的 markdown 文本） */
export interface MemoryListResponse {
  content: string
  content_size: number
  filter: {
    type: string
    project: string
    cluster: string
  }
}

/** Lesson 效果度量结果 */
export type EffectivenessVerdict =
  | 'improved'
  | 'unchanged'
  | 'worsened'
  | 'inconclusive'
  | 'too_recent'

export interface EffectivenessReport {
  lesson_id: string
  skill_pattern?: string
  args_signature?: string
  approved_at: string
  baseline_days: number
  after_days: number
  failure_count_before: number
  failure_count_after: number
  success_count_before: number
  success_count_after: number
  failures_per_day_before: number
  failures_per_day_after: number
  reduction_pct: number
  verdict: EffectivenessVerdict
  notes?: string
}

/** 批量效果度量响应（GET /api/v1/improve/lessons/effectiveness） */
export interface LessonsEffectivenessBatchResponse {
  count: number
  baseline_days: number
  items: Array<{
    lesson: Lesson
    effectiveness: EffectivenessReport
  }>
}

/** 自动定时反思的最新状态（GET /api/v1/improve/reflect/status） */
export interface ReflectStatus {
  enabled: boolean
  interval?: number          // 纳秒
  interval_seconds?: number  // 秒
  min_failures?: number
  window_seconds?: number
  last_run_at?: string
  last_added?: number
  last_skipped?: number
  last_error?: string
  next_run_at?: string
  total_runs?: number
  total_added?: number
}

/** Memory entry-level 条目（含 stable ID 供 delete） */
export interface MemoryEntry {
  id: string
  title: string
  body: string
  type: MemoryType
  scope: {
    Project?: string
    Cluster?: string
  }
  timestamp?: string
}

export interface MemoryEntriesListResponse {
  count: number
  entries: MemoryEntry[]
  filter: { type: string; project: string; cluster: string }
}

/** Skill dry-run 结果（result 是后端 ExecResult） */
export interface SkillDryRunResponse {
  skill: string
  result: {
    command?: string
    stdout?: string
    stderr?: string
    exit_code?: number
    dry_run?: boolean
    error?: string
    steps?: any[]
  }
}

/** 后端统一响应壳子 */
export interface ImproveResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
