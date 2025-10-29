import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// 流水线验证schema
const PipelineSchema = z.object({
  projectId: z.string().min(1, '项目ID不能为空'),
  name: z.string().min(1, '流水线名称不能为空').max(100, '流水线名称过长'),
  description: z.string().optional(),
  jenkinsJobName: z.string().min(1, 'Jenkins作业名称不能为空'),
  parameters: z.any().optional(),
  triggers: z.any().optional(),
  stages: z.any().optional()
})

// 获取流水线列表
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
    const projectId = searchParams.get('projectId')
    const search = searchParams.get('search') || ''

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {
      userId: user.id
    }

    if (projectId) {
      where.projectId = projectId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { jenkinsJobName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 查询流水线列表
    const [pipelines, total] = await Promise.all([
      prisma.pipeline.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              environment: true
            }
          },
          _count: {
            select: {
              builds: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.pipeline.count({ where })
    ])

    console.log(`✅ 获取流水线列表成功，共 ${pipelines.length} 个流水线`)

    return NextResponse.json({
      success: true,
      data: {
        pipelines,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取流水线列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取流水线列表失败'
    }, { status: 500 })
  }
}

// 创建流水线
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = PipelineSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 验证项目是否存在且属于当前用户
    const project = await prisma.cICDProject.findFirst({
      where: {
        id: data.projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json({
        success: false,
        error: '项目不存在或无权限访问'
      }, { status: 404 })
    }

    // 检查流水线名称是否已存在
    const existingPipeline = await prisma.pipeline.findFirst({
      where: {
        name: data.name,
        projectId: data.projectId,
        userId: user.id
      }
    })

    if (existingPipeline) {
      return NextResponse.json({
        success: false,
        error: '流水线名称已存在'
      }, { status: 409 })
    }

    // 创建流水线
    const pipeline = await prisma.pipeline.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        jenkinsJobName: data.jenkinsJobName,
        parameters: data.parameters,
        triggers: data.triggers,
        stages: data.stages,
        userId: user.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            environment: true
          }
        },
        _count: {
          select: {
            builds: true
          }
        }
      }
    })

    console.log('✅ 流水线创建成功:', pipeline.id)

    return NextResponse.json({
      success: true,
      data: pipeline,
      message: '流水线创建成功'
    })

  } catch (error) {
    console.error('❌ 创建流水线失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建流水线失败'
    }, { status: 500 })
  }
}
