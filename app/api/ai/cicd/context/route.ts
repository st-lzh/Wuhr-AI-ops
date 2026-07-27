import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import {
  CICDContextError,
  recordCICDContextRead,
  resolveCICDContext
} from '../../../../../lib/ai/cicdContext'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const prisma = await getPrismaClient()
    const projectId = new URL(request.url).searchParams.get('projectId') || undefined
    const pipelineWhere = projectId ? { projectId } : undefined
    const deploymentWhere = projectId ? { projectId } : undefined
    const buildWhere = projectId ? { pipeline: { projectId } } : undefined

    // 当前产品是单个可信运维团队，所有登录成员共享交付对象；写操作仍单独校验审批。
    const [projects, pipelines, deployments, builds] = await Promise.all([
      prisma.cICDProject.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        select: {
          id: true,
          name: true,
          description: true,
          environment: true,
          branch: true,
          repositoryUrl: true,
          isActive: true,
          serverId: true,
          updatedAt: true
        }
      }),
      prisma.pipeline.findMany({
        where: pipelineWhere,
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { builds: true } }
        }
      }),
      prisma.deployment.findMany({
        where: deploymentWhere,
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: { project: { select: { id: true, name: true } } }
      }),
      prisma.build.findMany({
        where: buildWhere,
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          pipeline: {
            include: { project: { select: { id: true, name: true } } }
          }
        }
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        projects: projects.map(project => ({ ...project, updatedAt: project.updatedAt.toISOString() })),
        pipelines: pipelines.map(pipeline => ({
          id: pipeline.id,
          name: pipeline.name,
          description: pipeline.description,
          projectId: pipeline.projectId,
          projectName: pipeline.project.name,
          jenkinsJobName: pipeline.jenkinsJobName,
          isActive: pipeline.isActive,
          buildCount: pipeline._count.builds,
          updatedAt: pipeline.updatedAt.toISOString()
        })),
        deployments: deployments.map(deployment => ({
          id: deployment.id,
          name: deployment.name,
          description: deployment.description,
          projectId: deployment.projectId,
          projectName: deployment.project?.name,
          environment: deployment.environment,
          version: deployment.version,
          status: deployment.status,
          requireApproval: deployment.requireApproval,
          isJenkinsDeployment: deployment.isJenkinsDeployment,
          updatedAt: deployment.updatedAt.toISOString()
        })),
        builds: builds.map(build => ({
          id: build.id,
          name: `${build.jenkinsJobName} #${build.buildNumber}`,
          projectId: build.pipeline?.project?.id,
          projectName: build.pipeline?.project?.name,
          pipelineId: build.pipelineId,
          pipelineName: build.pipeline?.name,
          buildNumber: build.buildNumber,
          status: build.status,
          result: build.result,
          updatedAt: build.updatedAt.toISOString()
        }))
      }
    })
  } catch (error) {
    console.error('获取 AI 交付对象失败:', error)
    return NextResponse.json({ success: false, error: '获取交付对象失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const prisma = await getPrismaClient()
    const context = await resolveCICDContext(prisma, {
      projectId: body.projectId,
      pipelineId: body.pipelineId,
      deploymentId: body.deploymentId,
      buildId: body.buildId
    })

    if (!context) {
      return NextResponse.json({ success: false, error: '请选择项目、流水线、发布任务或构建记录' }, { status: 400 })
    }

    await recordCICDContextRead(prisma, authResult.user.id, context)
    return NextResponse.json({ success: true, data: context })
  } catch (error) {
    if (error instanceof CICDContextError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('解析 AI 交付上下文失败:', error)
    return NextResponse.json({ success: false, error: '解析交付上下文失败' }, { status: 500 })
  }
}
