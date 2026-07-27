import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { canWriteTeamAssets } from '../../../../../lib/auth/teamAccess'
import {
  CICDReportTypeSchema,
  generateCICDAIReport
} from '../../../../../lib/ai/cicdReports'
import { CICDContextError } from '../../../../../lib/ai/cicdContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CreateReportSchema = z.object({
  reportType: CICDReportTypeSchema,
  projectId: z.string().optional(),
  pipelineId: z.string().optional(),
  deploymentId: z.string().optional(),
  buildId: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const params = new URL(request.url).searchParams
    const page = Math.max(Number(params.get('page')) || 1, 1)
    const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 100)
    const reportType = params.get('reportType')
    const status = params.get('status')
    const verdict = params.get('verdict')
    const where: Record<string, unknown> = {
      ...(reportType ? { reportType } : {}),
      ...(status ? { status } : {}),
      ...(verdict ? { verdict } : {}),
      ...(params.get('projectId') ? { projectId: params.get('projectId') } : {}),
      ...(params.get('pipelineId') ? { pipelineId: params.get('pipelineId') } : {}),
      ...(params.get('deploymentId') ? { deploymentId: params.get('deploymentId') } : {}),
      ...(params.get('buildId') ? { buildId: params.get('buildId') } : {})
    }
    const prisma = await getPrismaClient()
    const [reports, total] = await Promise.all([
      prisma.cICDAIReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: { select: { id: true, name: true } },
          pipeline: { select: { id: true, name: true } },
          build: { select: { id: true, buildNumber: true, jenkinsJobName: true, status: true } },
          deployment: { select: { id: true, name: true, environment: true, status: true } },
          user: { select: { id: true, username: true, realName: true } }
        }
      }),
      prisma.cICDAIReport.count({ where })
    ])
    return NextResponse.json({
      success: true,
      data: { reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
    })
  } catch (error) {
    console.error('查询 CI/CD AI 报告失败:', error)
    return NextResponse.json({ success: false, error: '查询 AI 报告失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const { user } = authResult
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有 CI/CD AI 分析权限' }, { status: 403 })
    }

    const parsed = CreateReportSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '报告参数无效', details: parsed.error.errors }, { status: 400 })
    }
    const prisma = await getPrismaClient()
    const report = await generateCICDAIReport({
      prisma,
      userId: user.id,
      reportType: parsed.data.reportType,
      contextInput: {
        projectId: parsed.data.projectId,
        pipelineId: parsed.data.pipelineId,
        deploymentId: parsed.data.deploymentId,
        buildId: parsed.data.buildId
      }
    })
    return NextResponse.json({ success: true, data: report, message: 'AI 报告已经生成并持久化' }, { status: 201 })
  } catch (error) {
    if (error instanceof CICDContextError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('生成 CI/CD AI 报告失败:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '生成 AI 报告失败' }, { status: 500 })
  }
}
