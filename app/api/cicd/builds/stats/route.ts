import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 获取构建统计信息
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30d' // 默认30天
    const pipelineId = searchParams.get('pipelineId')
    const jenkinsConfigId = searchParams.get('jenkinsConfigId')

    const prisma = await getPrismaClient()

    // 计算时间范围
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // 构建查询条件
    const where: any = {
      createdAt: {
        gte: startDate
      }
    }

    if (pipelineId) {
      where.pipelineId = pipelineId
    }

    if (jenkinsConfigId) {
      where.jenkinsConfigId = jenkinsConfigId
    }

    // 获取基本统计
    const [
      totalBuilds,
      successBuilds,
      failedBuilds,
      runningBuilds,
      pendingBuilds,
      abortedBuilds,
      unstableBuilds
    ] = await Promise.all([
      prisma.build.count({ where }),
      prisma.build.count({ where: { ...where, status: 'success' } }),
      prisma.build.count({ where: { ...where, status: 'failed' } }),
      prisma.build.count({ where: { ...where, status: 'running' } }),
      prisma.build.count({ where: { ...where, status: 'pending' } }),
      prisma.build.count({ where: { ...where, status: 'aborted' } }),
      prisma.build.count({ where: { ...where, status: 'unstable' } })
    ])

    // 计算成功率
    const completedBuilds = successBuilds + failedBuilds + abortedBuilds + unstableBuilds
    const successRate = completedBuilds > 0 ? Math.round((successBuilds / completedBuilds) * 100) : 0

    // 计算平均构建时间
    const buildsWithDuration = await prisma.build.findMany({
      where: {
        ...where,
        duration: { not: null },
        status: { in: ['success', 'failed', 'aborted', 'unstable'] }
      },
      select: { duration: true }
    })

    const avgDuration = buildsWithDuration.length > 0
      ? Math.round(buildsWithDuration.reduce((sum, build) => sum + (build.duration || 0), 0) / buildsWithDuration.length)
      : 0

    // 获取每日构建趋势（最近30天）
    // 注意：Prisma 把 Build model 映射到 builds 表，列名是 camelCase（userId / createdAt / pipelineId / jenkinsConfigId）
    // 用 $queryRawUnsafe 手动拼 SQL + 参数化绑定 user.id / startDate，避免 dev 下 Prisma.sql 跨模块 instanceof 失效
    const dailyTrendSql = `
      SELECT
        DATE("createdAt") as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM "builds"
      WHERE "createdAt" >= $1
        ${pipelineId ? `AND "pipelineId" = '${pipelineId.replace(/'/g, "''")}'` : ''}
        ${jenkinsConfigId ? `AND "jenkinsConfigId" = '${jenkinsConfigId.replace(/'/g, "''")}'` : ''}
      GROUP BY DATE("createdAt")
      ORDER BY date DESC
      LIMIT 30
    `
    const dailyTrend = await prisma.$queryRawUnsafe(dailyTrendSql, startDate) as Array<{
      date: string
      total: bigint
      success: bigint
      failed: bigint
    }>

    // 获取构建时长分布（用子查询包一层，避免 PostgreSQL 在 GROUP BY 不认 CASE 别名）
    const durationDistSql = `
      SELECT duration_range, COUNT(*) as count
      FROM (
        SELECT
          CASE
            WHEN duration < 60 THEN '< 1分钟'
            WHEN duration < 300 THEN '1-5分钟'
            WHEN duration < 900 THEN '5-15分钟'
            WHEN duration < 1800 THEN '15-30分钟'
            ELSE '> 30分钟'
          END as duration_range
        FROM "builds"
        WHERE "createdAt" >= $1
          AND duration IS NOT NULL
          AND status IN ('success', 'failed', 'aborted', 'unstable')
          ${pipelineId ? `AND "pipelineId" = '${pipelineId.replace(/'/g, "''")}'` : ''}
          ${jenkinsConfigId ? `AND "jenkinsConfigId" = '${jenkinsConfigId.replace(/'/g, "''")}'` : ''}
      ) sub
      GROUP BY duration_range
      ORDER BY
        CASE duration_range
          WHEN '< 1分钟' THEN 1
          WHEN '1-5分钟' THEN 2
          WHEN '5-15分钟' THEN 3
          WHEN '15-30分钟' THEN 4
          WHEN '> 30分钟' THEN 5
        END
    `
    const durationDistribution = await prisma.$queryRawUnsafe(durationDistSql, startDate) as Array<{
      duration_range: string
      count: bigint
    }>

    // 获取最近失败的构建
    const recentFailures = await prisma.build.findMany({
      where: {
        ...where,
        status: { in: ['failed', 'aborted', 'unstable'] }
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true
          }
        },
        jenkinsConfig: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // 获取最活跃的流水线
    // 注意：Pipeline 映射到 pipelines，Build 映射到 builds，列名都是 camelCase（需双引号）
    const topPipelinesSql = `
      SELECT
        p.id,
        p.name,
        COUNT(b.id) as build_count,
        SUM(CASE WHEN b.status = 'success' THEN 1 ELSE 0 END) as success_count,
        AVG(b.duration) as avg_duration
      FROM "pipelines" p
      LEFT JOIN "builds" b ON p.id = b."pipelineId"
      WHERE b."createdAt" >= $1
        ${pipelineId ? `AND p.id = '${pipelineId.replace(/'/g, "''")}'` : ''}
      GROUP BY p.id, p.name
      HAVING COUNT(b.id) > 0
      ORDER BY build_count DESC
      LIMIT 10
    `
    const topPipelines = await prisma.$queryRawUnsafe(topPipelinesSql, startDate) as Array<{
      id: string
      name: string
      build_count: bigint
      success_count: bigint
      avg_duration: number
    }>

    console.log('✅ 获取构建统计信息成功')

    return NextResponse.json({
      success: true,
      data: {
        // 基本统计
        total: totalBuilds,
        success: successBuilds,
        failed: failedBuilds,
        running: runningBuilds,
        pending: pendingBuilds,
        aborted: abortedBuilds,
        unstable: unstableBuilds,
        successRate,
        avgDuration,
        
        // 趋势数据
        dailyTrend: dailyTrend.map(item => ({
          date: item.date,
          total: Number(item.total),
          success: Number(item.success),
          failed: Number(item.failed)
        })),
        
        // 时长分布
        durationDistribution: durationDistribution.map(item => ({
          range: item.duration_range,
          count: Number(item.count)
        })),
        
        // 最近失败
        recentFailures: recentFailures.map(build => ({
          id: build.id,
          buildNumber: build.buildNumber,
          status: build.status,
          result: build.result,
          startedAt: build.startedAt,
          duration: build.duration,
          pipeline: build.pipeline,
          jenkinsConfig: build.jenkinsConfig
        })),
        
        // 活跃流水线
        topPipelines: topPipelines.map(pipeline => ({
          id: pipeline.id,
          name: pipeline.name,
          buildCount: Number(pipeline.build_count),
          successCount: Number(pipeline.success_count),
          successRate: Number(pipeline.build_count) > 0 
            ? Math.round((Number(pipeline.success_count) / Number(pipeline.build_count)) * 100)
            : 0,
          avgDuration: Math.round(pipeline.avg_duration || 0)
        })),
        
        // 查询参数
        timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 获取构建统计信息失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取构建统计信息失败'
    }, { status: 500 })
  }
}
