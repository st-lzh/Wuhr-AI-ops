import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// Elasticsearch查询接口
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { 
      query = '*',
      timeRange = { from: 'now-1h', to: 'now' },
      size = 50,
      from = 0,
      sort = [{ '@timestamp': { order: 'desc' } }],
      filters = []
    } = body

    const prisma = await getPrismaClient()

    // 获取ELK配置
    const elkConfigRecord = await prisma.systemConfig.findUnique({
      where: { key: 'elk_config' }
    })

    if (!elkConfigRecord) {
      return NextResponse.json({
        success: false,
        error: 'ELK系统未配置'
      }, { status: 400 })
    }

    const elkConfig = elkConfigRecord.value as any
    if (!elkConfig.enabled) {
      return NextResponse.json({
        success: false,
        error: 'ELK系统未启用'
      }, { status: 400 })
    }

    // 构建Elasticsearch查询
    const esQuery = {
      index: elkConfig.defaultIndex || 'logs-*',
      body: {
        query: {
          bool: {
            must: [],
            filter: [
              {
                range: {
                  '@timestamp': {
                    gte: timeRange.from,
                    lte: timeRange.to,
                    format: 'strict_date_optional_time'
                  }
                }
              }
            ]
          }
        },
        sort: sort,
        size: size,
        from: from,
        _source: ['@timestamp', 'level', 'message', 'source', 'host', 'logger', 'stack_trace']
      }
    }

    // 添加查询条件
    if (query && query !== '*') {
      (esQuery.body.query.bool.must as any[]).push({
        query_string: {
          query: query,
          default_field: 'message'
        }
      })
    }

    // 添加过滤器
    filters.forEach((filter: any) => {
      if (filter.field && filter.value) {
        switch (filter.operator) {
          case 'is':
            (esQuery.body.query.bool.filter as any[]).push({
              term: { [filter.field]: filter.value }
            })
            break
          case 'exists':
            (esQuery.body.query.bool.filter as any[]).push({
              exists: { field: filter.field }
            })
            break
          case 'range':
            (esQuery.body.query.bool.filter as any[]).push({
              range: { [filter.field]: filter.value }
            })
            break
        }
      }
    })

    console.log('🔍 Elasticsearch查询:', JSON.stringify(esQuery, null, 2))

    // 调用Elasticsearch API
    const esResponse = await fetch(`${elkConfig.elasticsearchUrl}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(esQuery.body)
    })

    if (!esResponse.ok) {
      const errorText = await esResponse.text()
      console.error('❌ Elasticsearch查询失败:', errorText)
      return NextResponse.json({
        success: false,
        error: `Elasticsearch查询失败: ${esResponse.status}`,
        details: errorText
      }, { status: 500 })
    }

    const esData = await esResponse.json()
    
    // 转换数据格式
    const logs = esData.hits.hits.map((hit: any) => ({
      id: hit._id,
      '@timestamp': hit._source['@timestamp'],
      level: hit._source.level || 'INFO',
      message: hit._source.message || '',
      source: hit._source.source || '',
      host: hit._source.host || '',
      logger: hit._source.logger || '',
      stack_trace: hit._source.stack_trace || '',
      _score: hit._score
    }))

    const result = {
      logs: logs,
      total: esData.hits.total.value || esData.hits.total,
      took: esData.took,
      aggregations: esData.aggregations || {}
    }

    console.log(`✅ 查询成功，返回 ${logs.length} 条日志，总计 ${result.total} 条`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ ELK搜索API错误:', error)
    return NextResponse.json({
      success: false,
      error: '搜索请求失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 获取日志聚合统计
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const timeRange = {
      from: searchParams.get('from') || 'now-1h',
      to: searchParams.get('to') || 'now'
    }

    const prisma = await getPrismaClient()

    // 获取ELK配置
    const elkConfigRecord = await prisma.systemConfig.findUnique({
      where: { key: 'elk_config' }
    })

    if (!elkConfigRecord) {
      return NextResponse.json({
        success: false,
        error: 'ELK系统未配置'
      }, { status: 400 })
    }

    const elkConfig = elkConfigRecord.value as any

    // 构建聚合查询
    const aggregationQuery = {
      index: elkConfig.defaultIndex || 'logs-*',
      body: {
        size: 0,
        query: {
          range: {
            '@timestamp': {
              gte: timeRange.from,
              lte: timeRange.to,
              format: 'strict_date_optional_time'
            }
          }
        },
        aggs: {
          levels: {
            terms: {
              field: 'level.keyword',
              size: 10
            }
          },
          sources: {
            terms: {
              field: 'source.keyword',
              size: 10
            }
          },
          timeline: {
            date_histogram: {
              field: '@timestamp',
              fixed_interval: '5m'
            }
          }
        }
      }
    }

    // 调用Elasticsearch API
    const esResponse = await fetch(`${elkConfig.elasticsearchUrl}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(aggregationQuery.body)
    })

    if (!esResponse.ok) {
      const errorText = await esResponse.text()
      console.error('❌ Elasticsearch聚合查询失败:', errorText)
      return NextResponse.json({
        success: false,
        error: `聚合查询失败: ${esResponse.status}`
      }, { status: 500 })
    }

    const esData = await esResponse.json()

    const stats = {
      total: esData.hits.total.value || esData.hits.total,
      levels: esData.aggregations.levels.buckets.map((bucket: any) => ({
        level: bucket.key,
        count: bucket.doc_count
      })),
      sources: esData.aggregations.sources.buckets.map((bucket: any) => ({
        source: bucket.key,
        count: bucket.doc_count
      })),
      timeline: esData.aggregations.timeline.buckets.map((bucket: any) => ({
        timestamp: bucket.key_as_string,
        count: bucket.doc_count
      }))
    }

    console.log('✅ 聚合统计查询成功')

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('❌ ELK统计API错误:', error)
    return NextResponse.json({
      success: false,
      error: '统计请求失败'
    }, { status: 500 })
  }
}
