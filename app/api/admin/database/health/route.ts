import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { dbConnectionManager } from '../../../../../lib/database/connectionManager'
import { databaseHealthChecker } from '../../../../../lib/database/healthChecker'
import { connectionLeakDetector } from '../../../../../lib/database/leakDetector'
import { getPrismaClient } from '../../../../../lib/config/database'

// 获取数据库健康状态
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    // 检查用户权限（只有管理员可以查看）
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '权限不足'
      }, { status: 403 })
    }

    console.log('🔍 执行完整的数据库健康检查...')

    // 执行完整的健康检查
    const healthCheckResult = await databaseHealthChecker.performHealthCheck()

    // 获取连接泄漏检测统计
    const leakStats = connectionLeakDetector.getLeakStats()

    // 获取数据库基本信息
    const prisma = await getPrismaClient()
    const dbInfo = await prisma.$queryRaw`
      SELECT
        current_database() as database_name,
        current_user as current_user,
        version() as version,
        now() as current_time
    ` as any[]

    // 获取连接统计信息
    const connectionInfo = await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    ` as any[]

    // 获取长时间运行的查询
    const longRunningQueries = await prisma.$queryRaw`
      SELECT
        pid,
        EXTRACT(EPOCH FROM (now() - pg_stat_activity.query_start))::integer AS duration_seconds,
        query,
        state
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '1 minute'
        AND state != 'idle'
        AND datname = current_database()
      ORDER BY duration_seconds DESC
      LIMIT 10
    ` as any[]

    // 获取数据库大小信息
    const dbSize = await prisma.$queryRaw`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_size_pretty(pg_total_relation_size('public.User')) as user_table_size,
        pg_size_pretty(pg_total_relation_size('public.ChatSession')) as chat_session_table_size
    ` as any[]

    const response = {
      success: true,
      data: {
        // 完整的健康检查结果
        healthCheck: healthCheckResult,

        // 连接泄漏检测统计
        leakDetection: leakStats,

        // 数据库详细信息
        database: {
          info: dbInfo[0],
          size: dbSize[0],
          connections: connectionInfo[0],
          longRunningQueries: longRunningQueries.map(query => ({
            pid: query.pid,
            durationSeconds: query.duration_seconds,
            state: query.state,
            query: query.query?.substring(0, 200) + (query.query?.length > 200 ? '...' : '')
          }))
        },

        // 系统建议
        recommendations: generateRecommendations(healthCheckResult),

        timestamp: new Date().toISOString()
      }
    }

    console.log('✅ 数据库健康检查完成')
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ 数据库健康检查失败:', error)
    return NextResponse.json({
      success: false,
      error: '数据库健康检查失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// 清理连接池
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    // 检查用户权限（只有管理员可以操作）
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '权限不足'
      }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    console.log(`🔧 执行数据库维护操作: ${action}`)

    switch (action) {
      case 'cleanup_timeout_operations':
        dbConnectionManager.cleanupTimeoutOperations()
        console.log('✅ 清理超时操作完成')
        break

      case 'kill_long_running_queries':
        const prisma = await getPrismaClient()
        
        // 获取长时间运行的查询
        const longQueries = await prisma.$queryRaw`
          SELECT pid
          FROM pg_stat_activity 
          WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
            AND state != 'idle'
            AND datname = current_database()
            AND pid != pg_backend_pid()
        ` as any[]

        // 终止长时间运行的查询
        for (const query of longQueries) {
          try {
            await prisma.$queryRaw`SELECT pg_terminate_backend(${query.pid})`
            console.log(`🔪 终止长时间运行的查询: PID ${query.pid}`)
          } catch (error) {
            console.warn(`⚠️ 无法终止查询 PID ${query.pid}:`, error)
          }
        }
        break

      case 'vacuum_analyze':
        const prisma2 = await getPrismaClient()
        
        // 执行 VACUUM ANALYZE（清理和分析表）
        await prisma2.$executeRaw`VACUUM ANALYZE`
        console.log('✅ 数据库清理和分析完成')
        break

      default:
        return NextResponse.json({
          success: false,
          error: '未知的维护操作'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `维护操作 ${action} 执行成功`
    })

  } catch (error) {
    console.error('❌ 数据库维护操作失败:', error)
    return NextResponse.json({
      success: false,
      error: '数据库维护操作失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

// 生成优化建议
function generateRecommendations(healthCheckResult: any): string[] {
  const recommendations: string[] = []

  // 基于健康检查结果生成建议
  if (!healthCheckResult.healthy) {
    recommendations.push('系统存在健康问题，需要立即关注')
  }

  // 基于告警生成建议
  healthCheckResult.alerts.forEach((alert: any) => {
    if (alert.level === 'critical') {
      recommendations.push(`紧急处理: ${alert.message}`)
    } else if (alert.level === 'warning') {
      recommendations.push(`注意: ${alert.message}`)
    }
  })

  // 添加健康检查中的建议
  if (healthCheckResult.recommendations) {
    recommendations.push(...healthCheckResult.recommendations)
  }

  // 基于连接池状态生成建议
  const poolStats = healthCheckResult.checks.connectionPool.stats
  if (poolStats.usagePercentage > 80) {
    recommendations.push('连接池使用率过高，考虑优化查询或增加连接数')
  }

  // 基于性能指标生成建议
  const perfMetrics = healthCheckResult.checks.performance.metrics
  if (perfMetrics.slowQueries > 0) {
    recommendations.push(`发现 ${perfMetrics.slowQueries} 个慢查询，建议优化`)
  }

  if (recommendations.length === 0) {
    recommendations.push('数据库运行状态良好，继续保持')
  }

  return recommendations
}
