import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'

// 流水线更新验证schema
const UpdatePipelineSchema = z.object({
  name: z.string().min(1, '流水线名称不能为空').max(100, '流水线名称过长').optional(),
  description: z.string().optional(),
  jenkinsJobName: z.string().min(1, 'Jenkins作业名称不能为空').optional(),
  parameters: z.any().optional(),
  triggers: z.any().optional(),
  stages: z.any().optional(),
  isActive: z.boolean().optional()
})

// 获取单个流水线详情
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

    // 查询流水线详情
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        userId: user.id
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            environment: true,
            repositoryUrl: true,
            branch: true
          }
        },
        builds: {
          select: {
            id: true,
            buildNumber: true,
            status: true,
            result: true,
            startedAt: true,
            completedAt: true,
            duration: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            builds: true
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

    console.log('✅ 获取流水线详情成功:', pipeline.id)

    return NextResponse.json({
      success: true,
      data: pipeline
    })

  } catch (error) {
    console.error('❌ 获取流水线详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取流水线详情失败'
    }, { status: 500 })
  }
}

// 更新流水线
export async function PUT(
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
    const body = await request.json()

    // 验证输入数据
    const validationResult = UpdatePipelineSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 验证流水线是否存在且属于当前用户
    const existingPipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        userId: user.id
      }
    })

    if (!existingPipeline) {
      return NextResponse.json({
        success: false,
        error: '流水线不存在或无权限访问'
      }, { status: 404 })
    }

    // 如果更新名称，检查是否与其他流水线冲突
    if (data.name && data.name !== existingPipeline.name) {
      const conflictPipeline = await prisma.pipeline.findFirst({
        where: {
          name: data.name,
          projectId: existingPipeline.projectId,
          userId: user.id,
          id: { not: pipelineId }
        }
      })

      if (conflictPipeline) {
        return NextResponse.json({
          success: false,
          error: '流水线名称已存在'
        }, { status: 409 })
      }
    }

    // 处理JSON字段
    const updateData: any = { ...data }
    
    // 如果传入的是字符串，尝试解析为JSON
    if (typeof data.parameters === 'string') {
      try {
        updateData.parameters = data.parameters ? JSON.parse(data.parameters) : null
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: '参数配置JSON格式错误'
        }, { status: 400 })
      }
    }

    if (typeof data.triggers === 'string') {
      try {
        updateData.triggers = data.triggers ? JSON.parse(data.triggers) : null
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: '触发器配置JSON格式错误'
        }, { status: 400 })
      }
    }

    if (typeof data.stages === 'string') {
      try {
        updateData.stages = data.stages ? JSON.parse(data.stages) : null
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: '阶段配置JSON格式错误'
        }, { status: 400 })
      }
    }

    // 更新流水线
    const updatedPipeline = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: updateData,
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

    console.log('✅ 流水线更新成功:', updatedPipeline.id)

    return NextResponse.json({
      success: true,
      data: updatedPipeline,
      message: '流水线更新成功'
    })

  } catch (error) {
    console.error('❌ 更新流水线失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新流水线失败'
    }, { status: 500 })
  }
}

// 删除流水线
export async function DELETE(
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

    // 验证流水线是否存在且属于当前用户
    const existingPipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        userId: user.id
      }
    })

    if (!existingPipeline) {
      return NextResponse.json({
        success: false,
        error: '流水线不存在或无权限访问'
      }, { status: 404 })
    }

    // 检查是否有关联的构建记录
    const buildCount = await prisma.build.count({
      where: { pipelineId: pipelineId }
    })

    if (buildCount > 0) {
      return NextResponse.json({
        success: false,
        error: `无法删除流水线，存在 ${buildCount} 个关联的构建记录`
      }, { status: 400 })
    }

    // 删除流水线
    await prisma.pipeline.delete({
      where: { id: pipelineId }
    })

    console.log('✅ 流水线删除成功:', pipelineId)

    return NextResponse.json({
      success: true,
      message: '流水线删除成功'
    })

  } catch (error) {
    console.error('❌ 删除流水线失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除流水线失败'
    }, { status: 500 })
  }
}
