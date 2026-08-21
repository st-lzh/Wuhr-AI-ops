import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getBackendApiKey } from '../../../../lib/improve/backendProxy'
import { getPrismaClient } from '../../../../lib/config/database'
import { ApprovalTargetError, resolveApprovalAgentBaseUrl } from '../../../../lib/ai/approvalTarget'

/**
 * 拒绝命令执行 API路由
 * 代理请求到kubelet-wuhrai后端
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const { approvalId, hostInfo, reason } = body

    if (!approvalId) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      )
    }

    const apiKey = getBackendApiKey()
    if (!apiKey) {
      return NextResponse.json({ success: false, message: '后端 API key 未配置' }, { status: 500 })
    }
    const prisma = await getPrismaClient()
    const baseUrl = await resolveApprovalAgentBaseUrl(prisma, hostInfo?.id)

    console.log('🔐 [拒绝命令] 发送请求到后端:', `${baseUrl}/api/approval/${approvalId}/reject`)

    // 代理请求到后端
    const response = await fetch(`${baseUrl}/api/approval/${approvalId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        reason: reason || '用户拒绝'
      }),
      signal: AbortSignal.timeout(15_000),
    })

    // 先获取文本，再尝试解析JSON
    const text = await response.text()
    console.log('🔐 [拒绝命令] 后端响应:', { status: response.status, text: text.substring(0, 200) })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: text || '拒绝命令失败' },
        { status: response.status }
      )
    }

    // 尝试解析JSON，如果失败则返回文本
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      // 如果不是JSON，返回成功（后端可能返回纯文本）
      return NextResponse.json({ success: true, message: text })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('拒绝命令失败:', error)
    if (error instanceof ApprovalTargetError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { success: false, message: error.message || '拒绝命令失败' },
      { status: 500 }
    )
  }
}
