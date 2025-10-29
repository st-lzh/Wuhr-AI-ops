import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'

// ELK查看器配置验证schema
const ViewerConfigSchema = z.object({
  layout: z.object({
    height: z.string().default('calc(100vh - 200px)'),
    showFilters: z.boolean().default(true),
    showTimeRange: z.boolean().default(true),
    autoRefresh: z.boolean().default(false),
    refreshInterval: z.number().default(30000),
    columns: z.array(z.string()).default(['@timestamp', 'level', 'message']),
    pageSize: z.number().default(50)
  }),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  })).optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark']).default('light'),
    fontSize: z.number().default(14),
    lineHeight: z.number().default(1.5),
    wordWrap: z.boolean().default(true),
    highlightErrors: z.boolean().default(true)
  }).optional()
})

// 获取用户的ELK查看器配置
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    // 查询用户的查看器配置
    const config = await prisma.eLKViewerConfig.findUnique({
      where: {
        userId: user.id
      }
    })

    // 如果没有配置，返回默认配置
    if (!config) {
      const defaultConfig = {
        layout: {
          height: 'calc(100vh - 200px)',
          showFilters: true,
          showTimeRange: true,
          autoRefresh: false,
          refreshInterval: 30000,
          columns: ['@timestamp', 'level', 'message'],
          pageSize: 50
        },
        filters: [],
        preferences: {
          theme: 'light',
          fontSize: 14,
          lineHeight: 1.5,
          wordWrap: true,
          highlightErrors: true
        }
      }

      return NextResponse.json({
        success: true,
        data: defaultConfig
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        layout: config.layout,
        filters: config.filters || [],
        preferences: config.preferences || {}
      }
    })

  } catch (error) {
    console.error('❌ 获取ELK查看器配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取查看器配置失败'
    }, { status: 500 })
  }
}

// 保存用户的ELK查看器配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()

    // 验证输入数据
    const validationResult = ViewerConfigSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    // 保存或更新配置
    const config = await prisma.eLKViewerConfig.upsert({
      where: {
        userId: user.id
      },
      update: {
        layout: data.layout,
        filters: data.filters || [],
        preferences: data.preferences || {}
      },
      create: {
        userId: user.id,
        layout: data.layout,
        filters: data.filters || [],
        preferences: data.preferences || {}
      }
    })

    console.log('✅ ELK查看器配置保存成功:', config.id)

    return NextResponse.json({
      success: true,
      data: {
        layout: config.layout,
        filters: config.filters,
        preferences: config.preferences
      },
      message: '查看器配置保存成功'
    })

  } catch (error) {
    console.error('❌ 保存ELK查看器配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '保存查看器配置失败'
    }, { status: 500 })
  }
}
