import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response

    const prisma = await getPrismaClient()
    const [elk, grafana, git, jenkins, alerts, artifacts] = await Promise.all([
      prisma.eLKConfig.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, host: true, port: true, updatedAt: true }
      }),
      prisma.grafanaConfig.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, host: true, port: true, protocol: true, updatedAt: true }
      }),
      prisma.gitCredential.findMany({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true, name: true, platform: true, authType: true, isDefault: true, updatedAt: true }
      }),
      prisma.jenkinsConfig.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, serverUrl: true, testStatus: true, lastTestAt: true, updatedAt: true }
      }),
      prisma.alertSource.findMany({
        where: { enabled: true }, orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, sourceType: true, lastReceivedAt: true, lastError: true, updatedAt: true }
      }),
      prisma.artifactRepository.findMany({
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true, name: true, repositoryType: true, baseUrl: true, status: true, isDefault: true, lastVerifiedAt: true, updatedAt: true }
      })
    ])

    return NextResponse.json({
      success: true,
      data: {
        connectors: {
          elk: { count: elk.length, items: elk },
          grafana: { count: grafana.length, items: grafana },
          git: { count: git.length, items: git },
          jenkins: { count: jenkins.length, items: jenkins },
          alerts: { count: alerts.length, items: alerts },
          artifacts: { count: artifacts.length, items: artifacts }
        },
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取接入总览失败:', error)
    return NextResponse.json({ success: false, error: '获取接入总览失败' }, { status: 500 })
  }
}
