import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const prisma = await getPrismaClient()
    const report = await prisma.cICDAIReport.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } },
        build: { select: { id: true, buildNumber: true, jenkinsJobName: true, status: true, result: true } },
        deployment: { select: { id: true, name: true, environment: true, status: true, version: true } },
        user: { select: { id: true, username: true, realName: true } }
      }
    })
    if (!report) return NextResponse.json({ success: false, error: 'AI 报告不存在' }, { status: 404 })
    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    console.error('获取 CI/CD AI 报告详情失败:', error)
    return NextResponse.json({ success: false, error: '获取 AI 报告详情失败' }, { status: 500 })
  }
}
