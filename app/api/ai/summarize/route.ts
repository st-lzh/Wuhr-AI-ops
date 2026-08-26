import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { requestMarkdownSummary } from '../../../../lib/ai/markdownSummary'
import { resolveRuntimeModelConfig } from '../../../../lib/ai/runtimeModelConfig'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const originalQuery = typeof body.originalQuery === 'string' ? body.originalQuery.trim() : ''
    const executionResults = typeof body.executionResults === 'string' ? body.executionResults.trim() : ''
    if (!originalQuery || !executionResults) {
      return NextResponse.json({ success: false, error: '缺少用户请求或真实执行结果' }, { status: 400 })
    }

    const prisma = await getPrismaClient()
    const model = await resolveRuntimeModelConfig({
      prisma,
      userId: authResult.user.id,
      model: typeof body.model === 'string' ? body.model : undefined,
      provider: typeof body.provider === 'string' ? body.provider : undefined
    })
    const content = await requestMarkdownSummary({
      model,
      originalQuery: originalQuery.slice(0, 20_000),
      executionResults: executionResults.slice(0, 200_000),
      isK8sMode: body.isK8sMode === true
    })

    return NextResponse.json({ success: true, content })
  } catch (error) {
    console.error('生成 Markdown 运维总结失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成总结失败' },
      { status: 500 }
    )
  }
}
