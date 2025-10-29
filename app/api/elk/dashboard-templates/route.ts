import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 预设仪表板模板
const DASHBOARD_TEMPLATES = [
  {
    name: '系统监控仪表板',
    description: '监控系统性能、错误日志和关键指标',
    category: 'system',
    tags: ['monitoring', 'system', 'performance'],
    config: {
      layout: {
        panels: [
          {
            id: 'error-logs',
            type: 'logs',
            title: '错误日志',
            position: { x: 0, y: 0, w: 6, h: 4 },
            config: {
              query: 'level:ERROR',
              timeRange: { from: 'now-1h', to: 'now' },
              columns: ['@timestamp', 'level', 'message', 'source']
            }
          },
          {
            id: 'log-levels',
            type: 'pie',
            title: '日志级别分布',
            position: { x: 6, y: 0, w: 3, h: 4 },
            config: {
              aggregation: {
                field: 'level',
                type: 'terms'
              }
            }
          },
          {
            id: 'timeline',
            type: 'histogram',
            title: '日志时间线',
            position: { x: 9, y: 0, w: 3, h: 4 },
            config: {
              aggregation: {
                field: '@timestamp',
                type: 'date_histogram',
                interval: '5m'
              }
            }
          },
          {
            id: 'recent-logs',
            type: 'logs',
            title: '最近日志',
            position: { x: 0, y: 4, w: 12, h: 6 },
            config: {
              query: '*',
              timeRange: { from: 'now-15m', to: 'now' },
              columns: ['@timestamp', 'level', 'message', 'source', 'host']
            }
          }
        ],
        grid: { columns: 12, rows: 10 }
      },
      filters: [
        { field: 'level', operator: 'exists', value: true }
      ],
      timeRange: { from: 'now-1h', to: 'now' },
      refreshInterval: 30000
    }
  },
  {
    name: '应用程序日志仪表板',
    description: '专注于应用程序日志分析和调试',
    category: 'application',
    tags: ['application', 'debug', 'logs'],
    config: {
      layout: {
        panels: [
          {
            id: 'app-errors',
            type: 'logs',
            title: '应用程序错误',
            position: { x: 0, y: 0, w: 8, h: 5 },
            config: {
              query: 'level:(ERROR OR FATAL) AND source:application',
              timeRange: { from: 'now-2h', to: 'now' },
              columns: ['@timestamp', 'level', 'message', 'stack_trace']
            }
          },
          {
            id: 'error-count',
            type: 'metric',
            title: '错误计数',
            position: { x: 8, y: 0, w: 2, h: 2 },
            config: {
              aggregation: {
                type: 'count',
                filter: 'level:(ERROR OR FATAL)'
              }
            }
          },
          {
            id: 'warning-count',
            type: 'metric',
            title: '警告计数',
            position: { x: 10, y: 0, w: 2, h: 2 },
            config: {
              aggregation: {
                type: 'count',
                filter: 'level:WARN'
              }
            }
          },
          {
            id: 'request-logs',
            type: 'logs',
            title: 'HTTP请求日志',
            position: { x: 8, y: 2, w: 4, h: 3 },
            config: {
              query: 'type:request OR type:http',
              timeRange: { from: 'now-1h', to: 'now' },
              columns: ['@timestamp', 'method', 'url', 'status', 'response_time']
            }
          },
          {
            id: 'all-logs',
            type: 'logs',
            title: '所有应用日志',
            position: { x: 0, y: 5, w: 12, h: 5 },
            config: {
              query: 'source:application',
              timeRange: { from: 'now-30m', to: 'now' },
              columns: ['@timestamp', 'level', 'logger', 'message']
            }
          }
        ],
        grid: { columns: 12, rows: 10 }
      },
      filters: [
        { field: 'source', operator: 'is', value: 'application' }
      ],
      timeRange: { from: 'now-1h', to: 'now' },
      refreshInterval: 15000
    }
  },
  {
    name: '安全审计仪表板',
    description: '安全事件监控和审计日志分析',
    category: 'security',
    tags: ['security', 'audit', 'monitoring'],
    config: {
      layout: {
        panels: [
          {
            id: 'security-events',
            type: 'logs',
            title: '安全事件',
            position: { x: 0, y: 0, w: 6, h: 5 },
            config: {
              query: 'category:security OR type:auth OR type:login',
              timeRange: { from: 'now-24h', to: 'now' },
              columns: ['@timestamp', 'event_type', 'user', 'ip_address', 'result']
            }
          },
          {
            id: 'failed-logins',
            type: 'logs',
            title: '登录失败',
            position: { x: 6, y: 0, w: 6, h: 5 },
            config: {
              query: 'type:login AND result:failed',
              timeRange: { from: 'now-24h', to: 'now' },
              columns: ['@timestamp', 'user', 'ip_address', 'reason']
            }
          },
          {
            id: 'ip-analysis',
            type: 'table',
            title: 'IP地址分析',
            position: { x: 0, y: 5, w: 4, h: 5 },
            config: {
              aggregation: {
                field: 'ip_address',
                type: 'terms',
                size: 10
              }
            }
          },
          {
            id: 'user-activity',
            type: 'table',
            title: '用户活动',
            position: { x: 4, y: 5, w: 4, h: 5 },
            config: {
              aggregation: {
                field: 'user',
                type: 'terms',
                size: 10
              }
            }
          },
          {
            id: 'security-timeline',
            type: 'histogram',
            title: '安全事件时间线',
            position: { x: 8, y: 5, w: 4, h: 5 },
            config: {
              aggregation: {
                field: '@timestamp',
                type: 'date_histogram',
                interval: '1h'
              }
            }
          }
        ],
        grid: { columns: 12, rows: 10 }
      },
      filters: [
        { field: 'category', operator: 'is', value: 'security' }
      ],
      timeRange: { from: 'now-24h', to: 'now' },
      refreshInterval: 60000
    }
  }
]

// 获取预设仪表板模板
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let templates = DASHBOARD_TEMPLATES

    // 按分类过滤
    if (category) {
      templates = templates.filter(template => template.category === category)
    }

    return NextResponse.json({
      success: true,
      data: templates
    })

  } catch (error) {
    console.error('❌ 获取仪表板模板失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取模板失败'
    }, { status: 500 })
  }
}

// 基于模板创建仪表板
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const body = await request.json()
    const { templateName, customName, customDescription } = body

    // 查找模板
    const template = DASHBOARD_TEMPLATES.find(t => t.name === templateName)
    if (!template) {
      return NextResponse.json({
        success: false,
        error: '模板不存在'
      }, { status: 404 })
    }

    const prisma = await getPrismaClient()

    // 创建基于模板的仪表板
    const dashboard = await prisma.kibanaDashboard.create({
      data: {
        userId: user.id,
        name: customName || template.name,
        description: customDescription || template.description,
        config: template.config,
        category: template.category,
        tags: template.tags,
        isTemplate: false,
        isDefault: false
      }
    })

    console.log('✅ 基于模板创建仪表板成功:', dashboard.id)

    return NextResponse.json({
      success: true,
      data: dashboard,
      message: '仪表板创建成功'
    })

  } catch (error) {
    console.error('❌ 基于模板创建仪表板失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建仪表板失败'
    }, { status: 500 })
  }
}
