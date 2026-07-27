import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

export const dynamic = 'force-dynamic'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 返回可信运维团队共享主机的真实数据库统计，不执行额外 SSH 探测。 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:read')
  if (!auth.success) return auth.response

  try {
    const prisma = await getPrismaClient()
    const now = new Date()
    const today = startOfDay(now)
    const week = new Date(today)
    week.setDate(week.getDate() - 6)
    const month = new Date(today.getFullYear(), today.getMonth(), 1)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [statusGroups, osGroups, locationGroups, recentConnected, neverConnected, todayNew, weekNew, monthNew] = await Promise.all([
      prisma.server.groupBy({ by: ['status'], where: { isActive: true }, _count: { _all: true } }),
      prisma.server.groupBy({ by: ['os'], where: { isActive: true }, _count: { _all: true }, orderBy: { _count: { os: 'desc' } } }),
      prisma.server.groupBy({ by: ['location'], where: { isActive: true }, _count: { _all: true }, orderBy: { _count: { location: 'desc' } } }),
      prisma.server.count({ where: { isActive: true, lastConnectedAt: { gte: oneHourAgo } } }),
      prisma.server.count({ where: { isActive: true, lastConnectedAt: null } }),
      prisma.server.count({ where: { isActive: true, createdAt: { gte: today } } }),
      prisma.server.count({ where: { isActive: true, createdAt: { gte: week } } }),
      prisma.server.count({ where: { isActive: true, createdAt: { gte: month } } })
    ])

    const counts = Object.fromEntries(statusGroups.map(item => [item.status, item._count._all])) as Record<string, number>
    const total = statusGroups.reduce((sum, item) => sum + item._count._all, 0)
    const online = counts.online || 0
    const warning = counts.warning || 0
    const offline = counts.offline || 0
    const error = counts.error || 0
    const problems = warning + offline + error

    return NextResponse.json({
      success: true,
      data: {
        total,
        online,
        warning,
        offline,
        error,
        healthPercentage: total ? Math.round((online / total) * 100) : 0,
        problemPercentage: total ? Math.round((problems / total) * 100) : 0,
        connection: { recentlyConnected: recentConnected, neverConnected },
        osStats: osGroups.map(item => ({ os: item.os || '未知系统', count: item._count._all })),
        locationStats: locationGroups.map(item => ({ location: item.location || '未设置', count: item._count._all })),
        newServers: { today: todayNew, weekly: weekNew, monthly: monthNew },
        generatedAt: now.toISOString()
      }
    })
  } catch (error) {
    console.error('统计主机数据失败:', error)
    return NextResponse.json({ success: false, error: '统计主机数据失败' }, { status: 500 })
  }
}
