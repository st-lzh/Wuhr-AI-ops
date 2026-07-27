import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const prisma = await getPrismaClient()
    const user = authResult.user
    const registrationCount = user.role === 'admin'
      ? prisma.userRegistration.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0)

    const [
      projects,
      activeDeployments,
      deploymentApprovals,
      jenkinsApprovals,
      pendingRegistrations,
      jenkinsConfigs,
      deployments,
      builds,
      reports
    ] = await Promise.all([
      prisma.cICDProject.count({ where: { isActive: true } }),
      prisma.deployment.count({ where: { status: { in: ['scheduled', 'deploying'] } } }),
      prisma.deploymentApproval.count({ where: { status: 'pending', approverId: user.id } }),
      prisma.jenkinsJobApproval.count({ where: { status: 'pending', approverId: user.id } }),
      registrationCount,
      prisma.jenkinsConfig.count({ where: { isActive: true } }),
      prisma.deployment.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, status: true, environment: true, updatedAt: true }
      }),
      prisma.build.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, jenkinsJobName: true, buildNumber: true, status: true, updatedAt: true }
      }),
      prisma.cICDAIReport.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, reportType: true, status: true, verdict: true, updatedAt: true }
      })
    ])

    const activities = [
      ...deployments.map(item => ({
        id: `deployment-${item.id}`,
        type: 'deployment',
        title: `部署「${item.name}」状态更新为 ${item.status}`,
        status: item.status,
        detail: item.environment,
        timestamp: item.updatedAt,
        href: `/cicd/deployments/${item.id}`
      })),
      ...builds.map(item => ({
        id: `build-${item.id}`,
        type: 'build',
        title: `构建「${item.jenkinsJobName} #${item.buildNumber}」状态更新为 ${item.status}`,
        status: item.status,
        detail: 'Jenkins 构建',
        timestamp: item.updatedAt,
        href: `/cicd/builds/${item.id}`
      })),
      ...reports.map(item => ({
        id: `report-${item.id}`,
        type: 'ai-report',
        title: `AI ${item.reportType} 报告：${item.verdict}`,
        status: item.status,
        detail: 'AI 分析报告',
        timestamp: item.updatedAt,
        href: '/cicd/ai-reports'
      }))
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8)

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          projects,
          activeDeployments,
          pendingApprovals: deploymentApprovals + jenkinsApprovals + pendingRegistrations,
          jenkinsConfigs
        },
        activities,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取 CI/CD 总览失败:', error)
    return NextResponse.json({ success: false, error: '获取 CI/CD 总览失败' }, { status: 500 })
  }
}
