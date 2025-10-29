import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// 自定义Kibana链接验证schema
const CustomLinkSchema = z.object({
  name: z.string().min(1, '链接名称不能为空'),
  description: z.string().optional(),
  url: z.string().url('请输入有效的URL'),
  icon: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false), // 是否公开给其他用户
  sortOrder: z.number().default(0)
})

// 获取用户的自定义Kibana链接
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const prisma = await getPrismaClient()

    // 简化查询条件，只查询用户自己的链接
    const where: any = {
      userId: user.id,
      isTemplate: false // 排除模板
    }

    if (category) {
      where.category = category
    }

    // 查询自定义链接
    const customLinks = await prisma.kibanaDashboard.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' }
      ]
    })

    // 转换为自定义链接格式
    const links = customLinks.map(dashboard => {
      const config = dashboard.config as any
      return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        url: generateKibanaUrl(dashboard.config),
        icon: config?.icon || 'LinkOutlined',
        category: dashboard.category,
        tags: dashboard.tags,
        isPublic: dashboard.isDefault, // 使用isDefault字段表示是否公开
        createdBy: dashboard.user.username,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      }
    })

    return NextResponse.json({
      success: true,
      data: links
    })

  } catch (error) {
    console.error('❌ 获取自定义Kibana链接失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取自定义链接失败'
    }, { status: 500 })
  }
}

// 创建新的自定义Kibana链接
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = CustomLinkSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 解析URL生成仪表板配置
    const dashboardConfig = parseKibanaUrl(data.url)

    // 创建自定义链接（作为仪表板记录）
    const customLink = await prisma.kibanaDashboard.create({
      data: {
        userId: user.id,
        name: data.name,
        description: data.description,
        config: {
          ...dashboardConfig,
          icon: data.icon,
          originalUrl: data.url
        },
        category: data.category,
        tags: data.tags,
        isTemplate: false,
        isDefault: data.isPublic // 使用isDefault字段表示是否公开
      }
    })

    console.log('✅ 自定义Kibana链接创建成功:', customLink.id)

    return NextResponse.json({
      success: true,
      data: {
        id: customLink.id,
        name: customLink.name,
        description: customLink.description,
        url: data.url,
        icon: data.icon,
        category: customLink.category,
        tags: customLink.tags,
        isPublic: data.isPublic,
        createdAt: customLink.createdAt
      },
      message: '自定义链接创建成功'
    })

  } catch (error) {
    console.error('❌ 创建自定义Kibana链接失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建自定义链接失败'
    }, { status: 500 })
  }
}

// 更新自定义Kibana链接
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
        error: '链接ID不能为空'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 验证链接是否存在且属于当前用户
    const existingLink = await prisma.kibanaDashboard.findFirst({
      where: {
        id,
        userId: user.id,
        isTemplate: false
      }
    })

    if (!existingLink) {
      return NextResponse.json({
        success: false,
        error: '链接不存在或无权限访问'
      }, { status: 404 })
    }

    // 解析新的URL
    const dashboardConfig = updateData.url ? parseKibanaUrl(updateData.url) : existingLink.config
    const existingConfig = existingLink.config as any

    // 更新链接
    const updatedLink = await prisma.kibanaDashboard.update({
      where: { id },
      data: {
        name: updateData.name || existingLink.name,
        description: updateData.description,
        config: {
          ...dashboardConfig,
          icon: updateData.icon,
          originalUrl: updateData.url || existingConfig?.originalUrl
        },
        category: updateData.category,
        tags: updateData.tags || existingLink.tags,
        isDefault: updateData.isPublic !== undefined ? updateData.isPublic : existingLink.isDefault
      }
    })

    console.log('✅ 自定义Kibana链接更新成功:', updatedLink.id)

    return NextResponse.json({
      success: true,
      data: updatedLink,
      message: '自定义链接更新成功'
    })

  } catch (error) {
    console.error('❌ 更新自定义Kibana链接失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新自定义链接失败'
    }, { status: 500 })
  }
}

// 删除自定义Kibana链接
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
        error: '链接ID不能为空'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 验证链接是否存在且属于当前用户
    const existingLink = await prisma.kibanaDashboard.findFirst({
      where: {
        id,
        userId: user.id,
        isTemplate: false
      }
    })

    if (!existingLink) {
      return NextResponse.json({
        success: false,
        error: '链接不存在或无权限访问'
      }, { status: 404 })
    }

    // 删除链接
    await prisma.kibanaDashboard.delete({
      where: { id }
    })

    console.log('✅ 自定义Kibana链接删除成功:', id)

    return NextResponse.json({
      success: true,
      message: '自定义链接删除成功'
    })

  } catch (error) {
    console.error('❌ 删除自定义Kibana链接失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除自定义链接失败'
    }, { status: 500 })
  }
}

// 辅助函数：从Kibana URL生成仪表板配置
function parseKibanaUrl(url: string): any {
  try {
    const urlObj = new URL(url)
    const hash = urlObj.hash
    
    // 简单的URL解析，可以根据需要扩展
    return {
      type: 'custom_link',
      url: url,
      path: urlObj.pathname,
      hash: hash,
      params: Object.fromEntries(urlObj.searchParams)
    }
  } catch (error) {
    return {
      type: 'custom_link',
      url: url
    }
  }
}

// 辅助函数：从仪表板配置生成Kibana URL
function generateKibanaUrl(config: any): string {
  const configObj = config as any

  if (configObj?.originalUrl) {
    return configObj.originalUrl
  }

  if (configObj?.url) {
    return configObj.url
  }

  // 默认返回Kibana首页
  return '/app/kibana'
}
