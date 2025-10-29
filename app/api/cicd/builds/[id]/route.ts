import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'

// 构建更新验证schema
const UpdateBuildSchema = z.object({
  status: z.enum(['pending', 'queued', 'running', 'success', 'failed', 'aborted', 'unstable']).optional(),
  result: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  logs: z.string().optional(),
  artifacts: z.any().optional()
})

// 获取单个构建详情
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
    const buildId = params.id
    const prisma = await getPrismaClient()

    // 查询构建详情
    const build = await prisma.build.findFirst({
      where: {
        id: buildId,
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
            name: true,
            description: true,
            isActive: true
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    })

    if (!build) {
      return NextResponse.json({
        success: false,
        error: '构建记录不存在或无权限访问'
      }, { status: 404 })
    }

    console.log('✅ 获取构建详情成功:', build.id)

    return NextResponse.json({
      success: true,
      data: build
    })

  } catch (error) {
    console.error('❌ 获取构建详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取构建详情失败'
    }, { status: 500 })
  }
}

// 更新构建记录
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
    const buildId = params.id
    const body = await request.json()

    // 验证输入数据
    const validationResult = UpdateBuildSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 验证构建记录是否存在且属于当前用户
    const existingBuild = await prisma.build.findFirst({
      where: {
        id: buildId,
        userId: user.id
      }
    })

    if (!existingBuild) {
      return NextResponse.json({
        success: false,
        error: '构建记录不存在或无权限访问'
      }, { status: 404 })
    }

    // 处理时间字段
    const updateData: any = { ...data }
    
    if (data.completedAt) {
      updateData.completedAt = new Date(data.completedAt)
    }

    // 如果状态变为完成状态且没有设置完成时间，自动设置
    if (data.status && ['success', 'failed', 'aborted', 'unstable'].includes(data.status) && !data.completedAt && !existingBuild.completedAt) {
      updateData.completedAt = new Date()
    }

    // 如果设置了完成时间且有开始时间，自动计算持续时间
    if (updateData.completedAt && existingBuild.startedAt && !data.duration) {
      const startTime = new Date(existingBuild.startedAt).getTime()
      const endTime = new Date(updateData.completedAt).getTime()
      updateData.duration = Math.round((endTime - startTime) / 1000)
    }

    // 更新构建记录
    const updatedBuild = await prisma.build.update({
      where: { id: buildId },
      data: updateData,
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

    console.log('✅ 构建记录更新成功:', updatedBuild.id)

    return NextResponse.json({
      success: true,
      data: updatedBuild,
      message: '构建记录更新成功'
    })

  } catch (error) {
    console.error('❌ 更新构建记录失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新构建记录失败'
    }, { status: 500 })
  }
}

// 删除构建记录
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
    const buildId = params.id
    const prisma = await getPrismaClient()

    // 验证构建记录是否存在且属于当前用户
    const existingBuild = await prisma.build.findFirst({
      where: {
        id: buildId,
        userId: user.id
      }
    })

    if (!existingBuild) {
      return NextResponse.json({
        success: false,
        error: '构建记录不存在或无权限访问'
      }, { status: 404 })
    }

    // 检查构建是否正在运行
    if (['pending', 'queued', 'running'].includes(existingBuild.status)) {
      return NextResponse.json({
        success: false,
        error: '无法删除正在运行的构建记录'
      }, { status: 400 })
    }

    // 删除构建记录
    await prisma.build.delete({
      where: { id: buildId }
    })

    console.log('✅ 构建记录删除成功:', buildId)

    return NextResponse.json({
      success: true,
      message: '构建记录删除成功'
    })

  } catch (error) {
    console.error('❌ 删除构建记录失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除构建记录失败'
    }, { status: 500 })
  }
}
