import type { PrismaClient } from '../generated/prisma'

export interface CICDContextInput {
  projectId?: string
  pipelineId?: string
  deploymentId?: string
  buildId?: string
}

export class CICDContextError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

const MAX_LOG_LENGTH = 12_000

function trimLog(value: string | null | undefined) {
  if (!value) return null
  if (value.length <= MAX_LOG_LENGTH) return value
  return `[日志前部已截断，仅保留最后 ${MAX_LOG_LENGTH} 字符]\n${value.slice(-MAX_LOG_LENGTH)}`
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * 解析 AI 会话引用的交付对象。只信任数据库中的 ID 关联，不接受客户端提交的脚本、日志或凭据。
 */
export async function resolveCICDContext(prisma: PrismaClient, input: CICDContextInput) {
  const projectId = input.projectId?.trim() || undefined
  const pipelineId = input.pipelineId?.trim() || undefined
  const deploymentId = input.deploymentId?.trim() || undefined
  const buildId = input.buildId?.trim() || undefined

  if (!projectId && !pipelineId && !deploymentId && !buildId) return null

  const [requestedProject, requestedPipeline, deployment, build] = await Promise.all([
    projectId
      ? prisma.cICDProject.findUnique({
        where: { id: projectId },
        include: {
          server: { select: { id: true, name: true, ip: true, status: true, isActive: true } },
          deployments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              name: true,
              environment: true,
              version: true,
              status: true,
              startedAt: true,
              completedAt: true,
              createdAt: true
            }
          },
          pipelines: {
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, jenkinsJobName: true, isActive: true }
          }
        }
      })
      : Promise.resolve(null),
    pipelineId
      ? prisma.pipeline.findUnique({
        where: { id: pipelineId },
        include: {
          project: {
            include: {
              server: { select: { id: true, name: true, ip: true, status: true, isActive: true } }
            }
          },
          builds: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              buildNumber: true,
              status: true,
              result: true,
              startedAt: true,
              completedAt: true,
              duration: true,
              buildUrl: true
            }
          }
        }
      })
      : Promise.resolve(null),
    deploymentId
      ? prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: {
            include: {
              server: { select: { id: true, name: true, ip: true, status: true, isActive: true } }
            }
          },
          build: {
            select: {
              id: true,
              buildNumber: true,
              status: true,
              result: true,
              buildUrl: true,
              startedAt: true,
              completedAt: true
            }
          },
          approvals: {
            include: { approver: { select: { id: true, username: true, realName: true } } },
            orderBy: { level: 'asc' }
          }
        }
      })
      : Promise.resolve(null),
    buildId
      ? prisma.build.findUnique({
        where: { id: buildId },
        include: {
          pipeline: {
            include: {
              project: {
                include: {
                  server: { select: { id: true, name: true, ip: true, status: true, isActive: true } }
                }
              }
            }
          },
          jenkinsConfig: { select: { id: true, name: true, serverUrl: true } },
          deployments: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, environment: true, status: true, version: true }
          }
        }
      })
      : Promise.resolve(null)
  ])

  if (projectId && !requestedProject) throw new CICDContextError('选择的交付项目不存在', 404)
  if (pipelineId && !requestedPipeline) throw new CICDContextError('选择的持续集成流水线不存在', 404)
  if (deploymentId && !deployment) throw new CICDContextError('选择的发布任务不存在', 404)
  if (buildId && !build) throw new CICDContextError('选择的构建记录不存在', 404)

  const inferredProject = deployment?.project || requestedPipeline?.project || build?.pipeline?.project || null
  if (requestedProject && inferredProject && requestedProject.id !== inferredProject.id) {
    throw new CICDContextError('项目与任务或构建记录不匹配，请重新选择交付对象', 400)
  }
  if (deployment && build && deployment.buildId && deployment.buildId !== build.id) {
    throw new CICDContextError('发布任务与构建记录不匹配，请重新选择交付对象', 400)
  }
  if (requestedPipeline && build?.pipelineId && requestedPipeline.id !== build.pipelineId) {
    throw new CICDContextError('流水线与构建记录不匹配，请重新选择交付对象', 400)
  }

  const project = requestedProject || inferredProject
  const deploymentHostIds = asStringArray(deployment?.deploymentHosts)
  const coordinatorHostId = project?.server?.isActive
    ? project.server.id
    : deploymentHostIds[0]

  return {
    selectedAt: new Date().toISOString(),
    kind: build ? 'build' : deployment ? 'deployment' : requestedPipeline ? 'pipeline' : 'project',
    coordinatorHostId,
    project: project ? {
      id: project.id,
      name: project.name,
      description: project.description,
      repositoryUrl: project.repositoryUrl,
      repositoryType: project.repositoryType,
      branch: project.branch,
      environment: project.environment,
      isActive: project.isActive,
      buildScript: project.buildScript,
      deployScript: project.deployScript,
      buildTimeout: project.buildTimeout,
      buildTriggers: project.buildTriggers,
      tags: project.tags,
      requireApproval: project.requireApproval,
      server: project.server || null,
      recentDeployments: 'deployments' in project ? project.deployments : undefined,
      pipelines: 'pipelines' in project ? project.pipelines : undefined
    } : null,
    pipeline: requestedPipeline ? {
      id: requestedPipeline.id,
      name: requestedPipeline.name,
      description: requestedPipeline.description,
      jenkinsJobName: requestedPipeline.jenkinsJobName,
      isActive: requestedPipeline.isActive,
      parameters: requestedPipeline.parameters,
      triggers: requestedPipeline.triggers,
      stages: requestedPipeline.stages,
      updatedAt: requestedPipeline.updatedAt,
      recentBuilds: requestedPipeline.builds
    } : build?.pipeline ? {
      id: build.pipeline.id,
      name: build.pipeline.name,
      description: build.pipeline.description,
      jenkinsJobName: build.pipeline.jenkinsJobName,
      isActive: build.pipeline.isActive,
      parameters: build.pipeline.parameters,
      triggers: build.pipeline.triggers,
      stages: build.pipeline.stages,
      updatedAt: build.pipeline.updatedAt,
      recentBuilds: undefined
    } : null,
    deployment: deployment ? {
      id: deployment.id,
      name: deployment.name,
      description: deployment.description,
      environment: deployment.environment,
      version: deployment.version,
      status: deployment.status,
      scheduledAt: deployment.scheduledAt,
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      duration: deployment.duration,
      requireApproval: deployment.requireApproval,
      isJenkinsDeployment: deployment.isJenkinsDeployment,
      jenkinsJobName: deployment.jenkinsJobName,
      deploymentHostIds,
      logs: trimLog(deployment.logs),
      approvals: deployment.approvals.map(approval => ({
        id: approval.id,
        level: approval.level,
        status: approval.status,
        comments: approval.comments,
        approvedAt: approval.approvedAt,
        approver: approval.approver
      })),
      build: deployment.build
    } : null,
    build: build ? {
      id: build.id,
      buildNumber: build.buildNumber,
      jenkinsJobName: build.jenkinsJobName,
      status: build.status,
      result: build.result,
      startedAt: build.startedAt,
      completedAt: build.completedAt,
      duration: build.duration,
      queueId: build.queueId,
      buildUrl: build.buildUrl,
      parameters: build.parameters,
      artifacts: build.artifacts,
      logs: trimLog(build.logs),
      pipeline: build.pipeline ? {
        id: build.pipeline.id,
        name: build.pipeline.name,
        jenkinsJobName: build.pipeline.jenkinsJobName
      } : null,
      jenkins: build.jenkinsConfig,
      deployments: build.deployments
    } : null
  }
}

/** 把真实快照注入 Agent；明确禁止把普通聊天误当作发布执行入口。 */
export function formatCICDContextPrompt(context: Awaited<ReturnType<typeof resolveCICDContext>>) {
  if (!context) return ''

  return `[CI/CD 交付上下文]\n以下 JSON 是服务端刚从数据库读取的真实交付快照。请基于它回答问题，并明确引用状态、时间和日志证据；缺失数据必须说明，禁止编造。\n${JSON.stringify(context, null, 2)}\n\n[交付操作边界]\n本次聊天只允许查询、分析、风险评估和建议。不得通过 bash、kubectl、MCP 或自定义工具绕过 CI/CD 审批直接执行发布、回滚、停止或重新构建。用户要求交付写操作时，请说明必须使用界面的结构化交付操作并经过审批。\n\n`
}

/** 持久化 AI 读取过的对象快照，便于审计和复盘。 */
export async function recordCICDContextRead(
  prisma: PrismaClient,
  userId: string,
  context: NonNullable<Awaited<ReturnType<typeof resolveCICDContext>>>
) {
  await prisma.systemLog.create({
    data: {
      level: 'info',
      category: 'ai_cicd',
      message: `AI 助手加载交付上下文：${context.deployment?.name || context.build?.id || context.pipeline?.name || context.project?.name}`,
      source: 'ai-assistant',
      userId,
      details: {
        action: 'context_read',
        projectId: context.project?.id,
        pipelineId: context.pipeline?.id,
        deploymentId: context.deployment?.id,
        buildId: context.build?.id,
        selectedAt: context.selectedAt,
        status: context.deployment?.status || context.build?.status || null
      }
    }
  })
}
