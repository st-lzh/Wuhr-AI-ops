import { z } from 'zod'
import type { PrismaClient } from '../generated/prisma'
import { resolveRuntimeModelConfig, type RuntimeModelConfig } from './runtimeModelConfig'
import { CICDContextError, resolveCICDContext, type CICDContextInput } from './cicdContext'

export const CICDReportTypeSchema = z.enum([
  'project_health',
  'pipeline_optimization',
  'build_diagnosis',
  'pre_deploy_risk',
  'post_deploy_verification'
])

export type CICDReportType = z.infer<typeof CICDReportTypeSchema>
type CheckStatus = 'pass' | 'warn' | 'block'

interface GateCheck {
  key: string
  label: string
  status: CheckStatus
  message: string
  evidence?: unknown
}

interface QualityGate {
  verdict: 'pass' | 'warn' | 'block'
  riskLevel: 'low' | 'medium' | 'high'
  blocksExecution: boolean
  generatedAt: string
  checks: GateCheck[]
}

const ModelReportSchema = z.object({
  summary: z.string().min(1).max(4000),
  analysis: z.string().min(1).max(20_000),
  recommendations: z.array(z.string().min(1).max(2000)).max(20).default([]),
  evidenceRefs: z.array(z.string().min(1).max(1000)).max(30).default([])
})

const REPORT_LABELS: Record<CICDReportType, string> = {
  project_health: '项目健康评估',
  pipeline_optimization: '流水线优化分析',
  build_diagnosis: '构建故障诊断',
  pre_deploy_risk: '发布前风险门禁',
  post_deploy_verification: '发布后效果验证'
}

function jsonValue(value: unknown): any {
  return JSON.parse(JSON.stringify(value))
}

function makeGate(checks: GateCheck[]): QualityGate {
  const verdict = checks.some(check => check.status === 'block')
    ? 'block'
    : checks.some(check => check.status === 'warn')
      ? 'warn'
      : 'pass'
  return {
    verdict,
    riskLevel: verdict === 'block' ? 'high' : verdict === 'warn' ? 'medium' : 'low',
    blocksExecution: verdict === 'block',
    generatedAt: new Date().toISOString(),
    checks
  }
}

function requireContextForType(type: CICDReportType, context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>) {
  if (type === 'project_health' && !context.project) throw new CICDContextError('项目健康评估必须选择项目', 400)
  if (type === 'pipeline_optimization' && !context.pipeline) throw new CICDContextError('流水线优化分析必须选择流水线', 400)
  if (type === 'build_diagnosis' && !context.build) throw new CICDContextError('构建故障诊断必须选择构建记录', 400)
  if ((type === 'pre_deploy_risk' || type === 'post_deploy_verification') && !context.deployment) {
    throw new CICDContextError('发布风险或效果验证必须选择发布任务', 400)
  }
}

function buildStatusCheck(context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>): GateCheck[] {
  const build = context.build
  if (!build) return []
  const terminalSuccess = build.status === 'success' || build.result?.toUpperCase() === 'SUCCESS'
  const terminalFailure = ['failed', 'aborted', 'unstable'].includes(build.status)
    || ['FAILURE', 'ABORTED', 'UNSTABLE'].includes(build.result?.toUpperCase() || '')
  return [
    {
      key: 'build_status',
      label: '构建状态',
      status: terminalSuccess ? 'pass' : terminalFailure ? 'block' : 'warn',
      message: terminalSuccess
        ? `构建 #${build.buildNumber} 已成功完成`
        : terminalFailure
          ? `构建 #${build.buildNumber} 的真实状态为 ${build.status}/${build.result || '-'}`
          : `构建 #${build.buildNumber} 尚未形成成功终态`,
      evidence: { status: build.status, result: build.result, completedAt: build.completedAt }
    },
    {
      key: 'build_logs',
      label: '构建日志',
      status: build.logs ? 'pass' : 'warn',
      message: build.logs ? '存在可供诊断的真实构建日志' : '构建记录没有持久化日志，诊断证据不足'
    }
  ]
}

function pipelineChecks(context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>): GateCheck[] {
  const pipeline = context.pipeline
  if (!pipeline) return []
  const builds = Array.isArray(pipeline.recentBuilds) ? pipeline.recentBuilds : []
  const completed = builds.filter(build => ['success', 'failed', 'aborted', 'unstable'].includes(build.status))
  const successful = completed.filter(build => build.status === 'success').length
  const successRate = completed.length > 0 ? successful / completed.length : null
  return [
    {
      key: 'pipeline_active',
      label: '流水线状态',
      status: pipeline.isActive ? 'pass' : 'block',
      message: pipeline.isActive ? '流水线处于启用状态' : '流水线已经停用'
    },
    {
      key: 'recent_success_rate',
      label: '近期成功率',
      status: successRate === null ? 'warn' : successRate >= 0.8 ? 'pass' : successRate >= 0.5 ? 'warn' : 'block',
      message: successRate === null
        ? '没有足够的已完成构建记录'
        : `最近 ${completed.length} 次已完成构建成功率为 ${Math.round(successRate * 100)}%`,
      evidence: { completed: completed.length, successful, successRate }
    },
    {
      key: 'pipeline_stages',
      label: '阶段配置',
      status: pipeline.stages ? 'pass' : 'warn',
      message: pipeline.stages ? '流水线存在持久化阶段配置' : '流水线尚未配置结构化阶段信息'
    }
  ]
}

async function deploymentChecks(
  prisma: PrismaClient,
  context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>,
  reportType: CICDReportType
): Promise<{ checks: GateCheck[]; verificationResults: unknown[] }> {
  const deployment = context.deployment
  if (!deployment) return { checks: [], verificationResults: [] }
  const stored = await prisma.deployment.findUnique({
    where: { id: deployment.id },
    select: { config: true, deploymentHosts: true, project: { select: { serverId: true } } }
  })
  const hostIds = Array.from(new Set([
    ...(Array.isArray(stored?.deploymentHosts) ? stored.deploymentHosts.filter((id): id is string => typeof id === 'string') : []),
    ...(stored?.project?.serverId ? [stored.project.serverId] : [])
  ]))
  const hosts = hostIds.length > 0
    ? await prisma.server.findMany({
        where: { id: { in: hostIds } },
        select: { id: true, name: true, ip: true, status: true, isActive: true, lastConnectedAt: true }
      })
    : []
  const unavailableHosts = hosts.filter(host => !host.isActive || host.status === 'offline')
  const checks: GateCheck[] = [
    {
      key: 'target_hosts',
      label: '目标主机',
      status: hostIds.length === 0 ? 'warn' : unavailableHosts.length > 0 ? 'block' : 'pass',
      message: hostIds.length === 0
        ? '发布任务没有关联目标主机'
        : unavailableHosts.length > 0
          ? `${unavailableHosts.length} 台目标主机离线或停用`
          : `${hosts.length} 台目标主机均处于可用状态`,
      evidence: hosts
    }
  ]

  if (reportType === 'pre_deploy_risk') {
    const approvals = deployment.approvals || []
    const allApproved = approvals.length > 0 && approvals.every(item => item.status === 'approved')
    checks.push({
      key: 'approval_state',
      label: '发布审批',
      status: deployment.requireApproval && !allApproved ? 'block' : deployment.requireApproval ? 'pass' : deployment.environment === 'prod' ? 'block' : 'warn',
      message: deployment.requireApproval
        ? allApproved ? '所需审批均已通过' : '仍有审批未通过'
        : deployment.environment === 'prod' ? '生产发布未启用审批' : '当前环境未启用审批',
      evidence: approvals.map(item => ({ level: item.level, status: item.status, approvedAt: item.approvedAt }))
    })
    const attachedBuild = deployment.build
    checks.push({
      key: 'release_build',
      label: '发布构建',
      status: !attachedBuild ? 'warn' : attachedBuild.status === 'success' ? 'pass' : 'block',
      message: !attachedBuild
        ? '发布任务没有关联构建记录'
        : attachedBuild.status === 'success'
          ? `关联构建 #${attachedBuild.buildNumber} 已成功`
          : `关联构建 #${attachedBuild.buildNumber} 状态为 ${attachedBuild.status}`,
      evidence: attachedBuild
    })
    checks.push({
      key: 'deployment_state',
      label: '发布状态',
      status: ['approved', 'scheduled'].includes(deployment.status) ? 'pass' : 'block',
      message: ['approved', 'scheduled'].includes(deployment.status)
        ? `发布任务状态 ${deployment.status} 允许进入执行阶段`
        : `发布任务当前状态 ${deployment.status} 不允许开始发布`
    })
    return { checks, verificationResults: [] }
  }

  checks.push({
    key: 'deployment_result',
    label: '发布结果',
    status: deployment.status === 'success' ? 'pass' : deployment.status === 'failed' ? 'block' : 'warn',
    message: deployment.status === 'success'
      ? '发布任务已形成成功终态'
      : deployment.status === 'failed'
        ? '发布任务真实状态为失败'
        : `发布任务状态为 ${deployment.status}，尚未完成`,
    evidence: { status: deployment.status, completedAt: deployment.completedAt, duration: deployment.duration }
  })

  const config = stored?.config && typeof stored.config === 'object' && !Array.isArray(stored.config)
    ? stored.config as Record<string, any>
    : {}
  const configuredChecks = Array.isArray(config.postDeployChecks)
    ? config.postDeployChecks.slice(0, 10)
    : Array.isArray(config.verification?.checks)
      ? config.verification.checks.slice(0, 10)
      : []
  const verificationResults: unknown[] = []

  for (const [index, configured] of configuredChecks.entries()) {
    const name = typeof configured?.name === 'string' ? configured.name : `HTTP 检查 ${index + 1}`
    const url = typeof configured?.url === 'string' ? configured.url : ''
    if (configured?.type !== 'http' || !/^https?:\/\//i.test(url)) {
      const result = { name, type: configured?.type, success: false, error: '仅支持已保存的 http/https 检查' }
      verificationResults.push(result)
      checks.push({ key: `verification_${index}`, label: name, status: 'block', message: result.error, evidence: result })
      continue
    }
    const timeoutMs = Math.min(Math.max(Number(configured.timeoutMs) || 5000, 1000), 15_000)
    const expectedStatus = Number(configured.expectedStatus) || 200
    const startedAt = Date.now()
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'Wuhr-AI-Ops-PostDeploy-Verification/1.0' }
      })
      const result = {
        name,
        type: 'http',
        url,
        expectedStatus,
        actualStatus: response.status,
        durationMs: Date.now() - startedAt,
        success: response.status === expectedStatus,
        checkedAt: new Date().toISOString()
      }
      verificationResults.push(result)
      checks.push({
        key: `verification_${index}`,
        label: name,
        status: result.success ? 'pass' : 'block',
        message: result.success ? `HTTP ${response.status}，验证通过` : `期望 HTTP ${expectedStatus}，实际 HTTP ${response.status}`,
        evidence: result
      })
    } catch (error) {
      const result = {
        name,
        type: 'http',
        url,
        durationMs: Date.now() - startedAt,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString()
      }
      verificationResults.push(result)
      checks.push({ key: `verification_${index}`, label: name, status: 'block', message: `真实探测失败：${result.error}`, evidence: result })
    }
  }
  if (configuredChecks.length === 0) {
    checks.push({
      key: 'post_deploy_checks',
      label: '业务探测',
      status: 'warn',
      message: '未配置 postDeployChecks，当前只能核对发布状态和目标主机状态'
    })
  }

  return { checks, verificationResults }
}

async function evaluateQualityGate(
  prisma: PrismaClient,
  reportType: CICDReportType,
  context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>
) {
  const checks: GateCheck[] = []
  let verificationResults: unknown[] = []
  if (reportType === 'project_health') {
    const project = context.project!
    checks.push(
      { key: 'project_active', label: '项目状态', status: project.isActive ? 'pass' : 'block', message: project.isActive ? '项目已启用' : '项目已停用' },
      { key: 'repository', label: '代码仓库', status: project.repositoryUrl ? 'pass' : 'block', message: project.repositoryUrl ? '已配置代码仓库' : '未配置代码仓库' },
      { key: 'coordinator', label: '协调主机', status: project.server?.isActive && project.server.status !== 'offline' ? 'pass' : 'warn', message: project.server ? `协调主机状态为 ${project.server.status}` : '项目未配置协调主机', evidence: project.server }
    )
  }
  if (reportType === 'pipeline_optimization') checks.push(...pipelineChecks(context))
  if (reportType === 'build_diagnosis') checks.push(...buildStatusCheck(context))
  if (reportType === 'pre_deploy_risk' || reportType === 'post_deploy_verification') {
    const deploymentEvaluation = await deploymentChecks(prisma, context, reportType)
    checks.push(...deploymentEvaluation.checks)
    verificationResults = deploymentEvaluation.verificationResults
  }
  return { gate: makeGate(checks), verificationResults }
}

function providerBaseUrl(model: RuntimeModelConfig): string {
  if (model.baseUrl?.trim()) return model.baseUrl.trim().replace(/\/+$/, '')
  const provider = model.provider.toLowerCase()
  if (provider.includes('deepseek')) return 'https://api.deepseek.com/v1'
  if (provider.includes('moonshot') || provider.includes('kimi')) return 'https://api.moonshot.cn/v1'
  if (provider.includes('qwen') || provider.includes('dashscope')) return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  if (provider.includes('glm') || provider.includes('zhipu')) return 'https://open.bigmodel.cn/api/paas/v4'
  if (provider.includes('anthropic') || provider.includes('claude')) return 'https://api.anthropic.com/v1'
  if (provider.includes('gemini')) return 'https://generativelanguage.googleapis.com/v1beta'
  return 'https://api.openai.com/v1'
}

function openAIChatUrl(baseUrl: string): string {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (/\/(v1|v4)$/i.test(baseUrl) || /\/compatible-mode\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  return `${baseUrl}/v1/chat/completions`
}

function extractJSONObject(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function requestModelReport(model: RuntimeModelConfig, prompt: string) {
  const baseUrl = providerBaseUrl(model)
  const provider = model.provider.toLowerCase()
  let response: Response

  if (provider.includes('anthropic') || provider.includes('claude')) {
    response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: model.model, max_tokens: 1800, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(90_000)
    })
  } else if (provider.includes('gemini')) {
    response = await fetch(`${baseUrl}/models/${encodeURIComponent(model.model)}:generateContent?key=${encodeURIComponent(model.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1800, responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(90_000)
    })
  } else {
    response = await fetch(openAIChatUrl(baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({
        model: model.model,
        temperature: 0.2,
        max_tokens: 1800,
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是严谨的 CI/CD 生产运维分析师。只能依据输入证据，缺失信息必须明确说明，禁止编造。' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(90_000)
    })
  }

  const responseText = await response.text()
  if (!response.ok) throw new Error(`模型请求失败 HTTP ${response.status}: ${responseText.slice(0, 1000)}`)
  const payload = JSON.parse(responseText) as any
  const content = provider.includes('anthropic') || provider.includes('claude')
    ? payload?.content?.map((item: any) => item?.text || '').join('')
    : provider.includes('gemini')
      ? payload?.candidates?.[0]?.content?.parts?.map((item: any) => item?.text || '').join('')
      : payload?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') throw new Error('模型响应没有文本内容')
  return { parsed: ModelReportSchema.parse(extractJSONObject(content)), raw: content.slice(0, 100_000) }
}

export async function generateCICDAIReport(options: {
  prisma: PrismaClient
  userId: string
  reportType: CICDReportType
  contextInput: CICDContextInput
}) {
  const context = await resolveCICDContext(options.prisma, options.contextInput)
  if (!context) throw new CICDContextError('请选择要分析的 CI/CD 对象', 400)
  requireContextForType(options.reportType, context)

  const { gate, verificationResults } = await evaluateQualityGate(options.prisma, options.reportType, context)
  const snapshot = jsonValue({ context, verificationResults, capturedAt: new Date().toISOString() })
  const report = await options.prisma.cICDAIReport.create({
    data: {
      reportType: options.reportType,
      status: 'generating',
      verdict: gate.verdict,
      riskLevel: gate.riskLevel,
      qualityGate: jsonValue(gate),
      evidence: jsonValue(gate.checks),
      inputSnapshot: snapshot,
      projectId: context.project?.id,
      pipelineId: context.pipeline?.id,
      buildId: context.build?.id,
      deploymentId: context.deployment?.id,
      userId: options.userId
    }
  })

  try {
    const runtimeModel = await resolveRuntimeModelConfig({ prisma: options.prisma, userId: options.userId })
    const prompt = [
      `请生成“${REPORT_LABELS[options.reportType]}”报告。`,
      '确定性质量门禁已经由程序计算，模型不得修改 verdict，也不得声称执行了输入中没有的检查。',
      '严格返回一个 JSON 对象，字段为：summary（简洁结论）、analysis（带证据的详细分析）、recommendations（按优先级排列的字符串数组）、evidenceRefs（引用状态、时间、日志或检查项的字符串数组）。',
      `确定性质量门禁：\n${JSON.stringify(gate)}`,
      `真实数据快照：\n${JSON.stringify(snapshot)}`
    ].join('\n\n')
    const modelResult = await requestModelReport(runtimeModel, prompt)
    const completed = await options.prisma.cICDAIReport.update({
      where: { id: report.id },
      data: {
        status: 'completed',
        summary: modelResult.parsed.summary,
        analysis: modelResult.parsed.analysis,
        recommendations: modelResult.parsed.recommendations,
        evidence: jsonValue([...gate.checks, ...modelResult.parsed.evidenceRefs.map(reference => ({ source: 'model_reference', reference }))]),
        rawResponse: modelResult.raw,
        modelProvider: runtimeModel.provider,
        modelName: runtimeModel.model,
        modelConfigId: runtimeModel.modelConfigId,
        completedAt: new Date()
      }
    })
    await options.prisma.systemLog.create({
      data: {
        level: gate.verdict === 'block' ? 'warn' : 'info',
        category: 'ai_cicd',
        source: 'cicd-ai-report',
        userId: options.userId,
        message: `CI/CD AI 报告完成：${REPORT_LABELS[options.reportType]} - ${gate.verdict}`,
        details: { action: 'cicd_ai_report', reportId: report.id, reportType: options.reportType, verdict: gate.verdict, projectId: context.project?.id, pipelineId: context.pipeline?.id, buildId: context.build?.id, deploymentId: context.deployment?.id }
      }
    })
    return completed
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await options.prisma.cICDAIReport.update({
      where: { id: report.id },
      data: { status: 'failed', error: errorMessage.slice(0, 10_000), completedAt: new Date() }
    })
    await options.prisma.systemLog.create({
      data: {
        level: 'error',
        category: 'ai_cicd',
        source: 'cicd-ai-report',
        userId: options.userId,
        message: `CI/CD AI 报告生成失败：${REPORT_LABELS[options.reportType]}`,
        details: { action: 'cicd_ai_report_failed', reportId: report.id, reportType: options.reportType, error: errorMessage }
      }
    })
    throw new CICDContextError(`AI 报告生成失败，失败记录已持久化：${errorMessage}`, 502)
  }
}

/** 发布成功后异步生成一次真实发布后验证报告；去重避免重复状态轮询消耗模型额度。 */
export function schedulePostDeploymentVerification(deploymentId: string, userId: string) {
  setImmediate(async () => {
    const { getPrismaClient } = await import('../config/database')
    const prisma = await getPrismaClient()
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { completedAt: true, status: true }
      })
      if (!deployment || deployment.status !== 'success') return
      const existing = await prisma.cICDAIReport.findFirst({
        where: {
          deploymentId,
          reportType: 'post_deploy_verification',
          createdAt: deployment.completedAt ? { gte: deployment.completedAt } : undefined
        },
        select: { id: true }
      })
      if (existing) return
      await generateCICDAIReport({
        prisma,
        userId,
        reportType: 'post_deploy_verification',
        contextInput: { deploymentId }
      })
    } catch (error) {
      // generateCICDAIReport 会持久化失败记录；这里仅防止后台任务成为未处理异常。
      console.error('自动发布后验证失败:', error)
    }
  })
}
