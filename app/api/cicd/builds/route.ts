import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// 构建记录验证schema
const BuildSchema = z.object({
  jenkinsConfigId: z.string().min(1, 'Jenkins配置ID不能为空'),
  pipelineId: z.string().optional(),
  buildNumber: z.number().int().positive(),
  jenkinsJobName: z.string().min(1, 'Jenkins作业名称不能为空'),
  status: z.enum(['pending', 'queued', 'running', 'success', 'failed', 'aborted', 'unstable']).default('pending'),
  result: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  queueId: z.string().optional(),
  buildUrl: z.string().url().optional(),
  parameters: z.any().optional(),
  artifacts: z.any().optional(),
  logs: z.string().optional()
})

// 获取构建记录列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const jenkinsConfigId = searchParams.get('jenkinsConfigId')
    const pipelineId = searchParams.get('pipelineId')
    const projectId = searchParams.get('projectId') // 新增：支持按项目查询
    const status = searchParams.get('status')

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {
      userId: user.id
    }

    if (jenkinsConfigId) {
      where.jenkinsConfigId = jenkinsConfigId
    }

    if (pipelineId) {
      where.pipelineId = pipelineId
    }

    if (status) {
      where.status = status
    }

    // 如果指定了projectId，通过pipeline关联查询
    if (projectId) {
      where.pipeline = {
        projectId: projectId
      }
    }

    // 查询构建记录列表
    const [builds, total] = await Promise.all([
      prisma.build.findMany({
        where,
        include: {
          jenkinsConfig: {
            select: {
              id: true,
              name: true,
              serverUrl: true
            }
          },
          pipeline: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.build.count({ where })
    ])

    console.log(`✅ 获取构建记录列表成功，共 ${builds.length} 个记录`)

    return NextResponse.json({
      success: true,
      data: {
        builds,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取构建记录列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取构建记录列表失败'
    }, { status: 500 })
  }
}

// 创建构建记录
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = BuildSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 验证Jenkins配置是否存在且属于当前用户
    const jenkinsConfig = await prisma.jenkinsConfig.findFirst({
      where: {
        id: data.jenkinsConfigId,
        userId: user.id
      }
    })

    if (!jenkinsConfig) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在或无权限访问'
      }, { status: 404 })
    }

    // 如果指定了流水线，验证其是否存在
    if (data.pipelineId) {
      const pipeline = await prisma.pipeline.findFirst({
        where: {
          id: data.pipelineId,
          userId: user.id
        }
      })

      if (!pipeline) {
        return NextResponse.json({
          success: false,
          error: '流水线不存在或无权限访问'
        }, { status: 404 })
      }
    }

    // 处理时间字段
    const startedAt = data.startedAt ? new Date(data.startedAt) : null
    const completedAt = data.completedAt ? new Date(data.completedAt) : null

    // 创建构建记录
    const build = await prisma.build.create({
      data: {
        jenkinsConfigId: data.jenkinsConfigId,
        pipelineId: data.pipelineId,
        buildNumber: data.buildNumber,
        jenkinsJobName: data.jenkinsJobName,
        status: data.status,
        result: data.result,
        startedAt: startedAt,
        completedAt: completedAt,
        duration: data.duration,
        queueId: data.queueId,
        buildUrl: data.buildUrl,
        parameters: data.parameters,
        artifacts: data.artifacts,
        logs: data.logs,
        userId: user.id
      },
      include: {
        jenkinsConfig: {
          select: {
            id: true,
            name: true,
            serverUrl: true
          }
        },
        pipeline: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log('✅ 构建记录创建成功:', build.id)

    return NextResponse.json({
      success: true,
      data: build,
      message: '构建记录创建成功'
    })

  } catch (error) {
    console.error('❌ 创建构建记录失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建构建记录失败'
    }, { status: 500 })
  }
}
