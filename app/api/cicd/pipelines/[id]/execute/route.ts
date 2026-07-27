import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { z } from 'zod'
import { createJenkinsClient } from '../../../../../../lib/jenkins/client'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 执行流水线验证schema
const ExecutePipelineSchema = z.object({
  buildParameters: z.record(z.any()).optional(),
  environment: z.string().optional(),
  branch: z.string().optional()
})

// 执行流水线
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (user.role !== 'admin' && user.role !== 'manager' && !user.permissions.includes('cicd:write')) {
      return NextResponse.json({ success: false, error: '没有流水线执行权限' }, { status: 403 })
    }
    const pipelineId = params.id
    const body = await request.json()

    // 验证输入数据
    const validationResult = ExecutePipelineSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { buildParameters, environment, branch } = validationResult.data
    const prisma = await getPrismaClient()

    console.log('🚀 执行流水线:', { pipelineId, buildParameters, environment, branch })

    // 获取流水线详情
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        isActive: true
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repositoryUrl: true,
            branch: true
          }
        }
      }
    })

    if (!pipeline) {
      return NextResponse.json({
        success: false,
        error: '流水线不存在或无权限访问'
      }, { status: 404 })
    }

    // 检查是否有正在运行的构建
    const runningBuild = await prisma.build.findFirst({
      where: {
        pipelineId: pipelineId,
        status: 'running'
      }
    })

    if (runningBuild) {
      return NextResponse.json({
        success: false,
        error: '流水线正在执行中，请勿重复执行'
      }, { status: 400 })
    }

    // 生成构建号
    const lastBuild = await prisma.build.findFirst({
      where: { pipelineId: pipelineId },
      orderBy: { buildNumber: 'desc' }
    })
    const nextBuildNumber = (lastBuild?.buildNumber || 0) + 1

    // 执行参数
    const executionParameters = {
      ...buildParameters,
      environment: environment || 'dev',
      branch: branch || pipeline.project.branch || 'main',
      triggeredBy: user.id,
      triggeredAt: new Date().toISOString()
    }

    const jenkinsConfig = await prisma.jenkinsConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    })

    if (!jenkinsConfig) {
      return NextResponse.json({
        success: false,
        error: '没有可用的 Jenkins 配置，流水线未执行'
      }, { status: 400 })
    }

    try {
      const client = createJenkinsClient({
        jobUrl: jenkinsConfig.serverUrl,
        authToken: jenkinsConfig.username && jenkinsConfig.apiToken
          ? `${jenkinsConfig.username}:${jenkinsConfig.apiToken}`
          : jenkinsConfig.apiToken || undefined
      })
      const queued = await client.buildJob({
        jobName: pipeline.jenkinsJobName,
        parameters: executionParameters
      })

      const build = await prisma.$transaction(async tx => {
        const created = await tx.build.create({
          data: {
            jenkinsConfigId: jenkinsConfig.id,
            pipelineId: pipeline.id,
            buildNumber: nextBuildNumber,
            jenkinsJobName: pipeline.jenkinsJobName,
            status: 'queued',
            queueId: String(queued.queueId),
            buildUrl: queued.queueUrl,
            parameters: executionParameters,
            userId: user.id
          }
        })
        await tx.pipeline.update({ where: { id: pipelineId }, data: { updatedAt: new Date() } })
        await tx.systemLog.create({
          data: {
            level: 'info',
            category: 'cicd_pipeline',
            message: `流水线已进入 Jenkins 队列：${pipeline.name} #${nextBuildNumber}`,
            source: 'cicd-api',
            userId: user.id,
            details: {
              pipelineId,
              buildId: created.id,
              queueId: queued.queueId,
              queueUrl: queued.queueUrl,
              executionParameters
            }
          }
        })
        return created
      })

      console.log('✅ 流水线已进入 Jenkins 队列:', { pipelineId, buildId: build.id, queueId: queued.queueId })

      return NextResponse.json({
        success: true,
        data: {
          pipelineId: pipeline.id,
          buildId: build.id,
          buildNumber: nextBuildNumber,
          status: 'queued',
          queueId: queued.queueId,
          queueUrl: queued.queueUrl,
          executionParameters
        },
        message: '流水线已提交到 Jenkins 队列'
      })

    } catch (error) {
      console.error('❌ 流水线执行失败:', error)

      // 流水线执行失败（Pipeline模型没有构建状态字段）
      console.log('❌ 流水线执行失败')

      return NextResponse.json({
        success: false,
        error: `流水线执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ 执行流水线失败:', error)
    return NextResponse.json({
      success: false,
      error: '执行流水线失败'
    }, { status: 500 })
  }
}

// 获取流水线执行状态
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const pipelineId = params.id
    const prisma = await getPrismaClient()

    // 获取流水线状态
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        updatedAt: true
      }
    })

    if (!pipeline) {
      return NextResponse.json({
        success: false,
        error: '流水线不存在或无权限访问'
      }, { status: 404 })
    }

    // 获取最新的构建信息
    const latestBuild = await prisma.build.findFirst({
      where: { pipelineId: pipelineId },
      orderBy: { buildNumber: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        pipelineId: pipeline.id,
        name: pipeline.name,
        buildNumber: latestBuild?.buildNumber || 0,
        status: latestBuild?.status || 'unknown',
        result: latestBuild?.result || null,
        lastExecutedAt: latestBuild?.startedAt || pipeline.updatedAt
      }
    })

  } catch (error) {
    console.error('❌ 获取流水线状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取流水线状态失败'
    }, { status: 500 })
  }
}
