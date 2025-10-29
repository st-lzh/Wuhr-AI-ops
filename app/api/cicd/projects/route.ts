import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// CI项目验证schema - 只保留CI相关字段
const CICDProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100, '项目名称过长'),
  description: z.string().optional(),
  repositoryUrl: z.string().url('请输入有效的仓库URL'),
  repositoryType: z.string().default('git'),
  branch: z.string().default('main'),
  buildScript: z.string().optional(),
  testScript: z.string().optional(),
  environment: z.enum(['dev', 'test', 'prod']).default('dev'),
  gitCredentialId: z.string().optional(), // Git认证配置ID
  notificationUsers: z.array(z.string()).optional(),
  buildTriggers: z.object({
    onPush: z.boolean().default(true),
    onPullRequest: z.boolean().default(false),
    onSchedule: z.boolean().default(false),
    scheduleExpression: z.string().optional()
  }).optional(),
  buildTimeout: z.number().min(1).max(480).optional(), // 1-480分钟
  tags: z.array(z.string()).optional(),
  environmentVariables: z.record(z.string()).optional(),
  requireApproval: z.boolean().optional().default(false),
  approvalUsers: z.array(z.string()).optional()
})

// 获取CI/CD项目列表
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
    const search = searchParams.get('search') || ''
    const environment = searchParams.get('environment')

    const prisma = await getPrismaClient()

    // 设置请求超时控制
    const requestTimeout = 15000 // 15秒超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('数据库查询超时')), requestTimeout)
    })

    // 构建查询条件
    const where: any = {
      userId: user.id
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (environment) {
      where.environment = environment
    }

    // 查询项目列表，添加超时控制
    const [projects, total] = await Promise.race([
      Promise.all([
        prisma.cICDProject.findMany({
          where,
          include: {
            _count: {
              select: {
                deployments: true,
                pipelines: true
              }
            }
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.cICDProject.count({ where })
      ]),
      timeoutPromise
    ]) as any

    console.log(`✅ 获取CI/CD项目列表成功，共 ${projects.length} 个项目`)

    return NextResponse.json({
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取CI/CD项目列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取项目列表失败'
    }, { status: 500 })
  }
}

// 创建CI/CD项目
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = CICDProjectSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 检查项目名称是否已存在
    const existingProject = await prisma.cICDProject.findFirst({
      where: {
        name: data.name,
        userId: user.id
      }
    })

    if (existingProject) {
      return NextResponse.json({
        success: false,
        error: '项目名称已存在'
      }, { status: 409 })
    }

    // 创建项目
    const project = await prisma.cICDProject.create({
      data: {
        ...data,
        userId: user.id
      },
      include: {
        _count: {
          select: {
            deployments: true,
            pipelines: true
          }
        }
      }
    })

    console.log('✅ CI/CD项目创建成功:', project.id)

    // 异步记录详细日志（不阻塞响应）
    import('../../../../lib/logging/projectLogManager').then(({ recordProjectCreationLogs }) => {
      recordProjectCreationLogs(project.id, user.id, data).catch((error: any) => {
        console.error('记录项目创建日志失败:', error)
      })
    })

    return NextResponse.json({
      success: true,
      data: project,
      message: '项目创建成功'
    })

  } catch (error) {
    console.error('❌ 创建CI/CD项目失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建项目失败'
    }, { status: 500 })
  }
}


