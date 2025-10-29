import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// Kibana仪表板验证schema
const DashboardSchema = z.object({
  name: z.string().min(1, '仪表板名称不能为空'),
  description: z.string().optional(),
  config: z.object({
    layout: z.object({
      panels: z.array(z.any()),
      grid: z.object({
        columns: z.number(),
        rows: z.number()
      }).optional()
    }),
    filters: z.array(z.any()).optional(),
    timeRange: z.object({
      from: z.string(),
      to: z.string()
    }).optional(),
    refreshInterval: z.number().optional()
  }),
  isTemplate: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  category: z.string().optional(),
  tags: z.array(z.string()).default([])
})

// 获取用户的Kibana仪表板列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const isTemplate = searchParams.get('template') === 'true'
    const category = searchParams.get('category')

    const prisma = await getPrismaClient()

    // 构建查询条件
    const where: any = {
      userId: user.id
    }

    if (isTemplate !== null) {
      where.isTemplate = isTemplate
    }

    if (category) {
      where.category = category
    }

    // 查询仪表板
    const dashboards = await prisma.kibanaDashboard.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: dashboards
    })

  } catch (error) {
    console.error('❌ 获取Kibana仪表板失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取仪表板失败'
    }, { status: 500 })
  }
}

// 创建新的Kibana仪表板
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = DashboardSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 如果设置为默认仪表板，先取消其他默认仪表板
    if (data.isDefault) {
      await prisma.kibanaDashboard.updateMany({
        where: {
          userId: user.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    // 创建仪表板
    const dashboard = await prisma.kibanaDashboard.create({
      data: {
        ...data,
        userId: user.id
      }
    })

    console.log('✅ Kibana仪表板创建成功:', dashboard.id)

    return NextResponse.json({
      success: true,
      data: dashboard,
      message: '仪表板创建成功'
    })

  } catch (error) {
    console.error('❌ 创建Kibana仪表板失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建仪表板失败'
    }, { status: 500 })
  }
}

// 更新Kibana仪表板
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '仪表板ID不能为空'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 验证仪表板是否存在且属于当前用户
    const existingDashboard = await prisma.kibanaDashboard.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!existingDashboard) {
      return NextResponse.json({
        success: false,
        error: '仪表板不存在或无权限访问'
      }, { status: 404 })
    }

    // 如果设置为默认仪表板，先取消其他默认仪表板
    if (updateData.isDefault) {
      await prisma.kibanaDashboard.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    // 更新仪表板
    const updatedDashboard = await prisma.kibanaDashboard.update({
      where: { id },
      data: updateData
    })

    console.log('✅ Kibana仪表板更新成功:', updatedDashboard.id)

    return NextResponse.json({
      success: true,
      data: updatedDashboard,
      message: '仪表板更新成功'
    })

  } catch (error) {
    console.error('❌ 更新Kibana仪表板失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新仪表板失败'
    }, { status: 500 })
  }
}

// 删除Kibana仪表板
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '仪表板ID不能为空'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 验证仪表板是否存在且属于当前用户
    const existingDashboard = await prisma.kibanaDashboard.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!existingDashboard) {
      return NextResponse.json({
        success: false,
        error: '仪表板不存在或无权限访问'
      }, { status: 404 })
    }

    // 删除仪表板
    await prisma.kibanaDashboard.delete({
      where: { id }
    })

    console.log('✅ Kibana仪表板删除成功:', id)

    return NextResponse.json({
      success: true,
      message: '仪表板删除成功'
    })

  } catch (error) {
    console.error('❌ 删除Kibana仪表板失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除仪表板失败'
    }, { status: 500 })
  }
}
