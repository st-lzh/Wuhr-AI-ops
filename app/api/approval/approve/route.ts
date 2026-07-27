import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getBackendApiKey, getBackendBaseUrl } from '../../../../lib/improve/backendProxy'

/**
 * 批准命令执行 API路由
 * 代理请求到kubelet-wuhrai后端
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const { approvalId } = body

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
    const baseUrl = getBackendBaseUrl().replace(/\/$/, '')

    console.log('🔐 [批准命令] 发送请求到后端:', `${baseUrl}/api/approval/${approvalId}/approve`)

    // 代理请求到后端
    const response = await fetch(`${baseUrl}/api/approval/${approvalId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    })

    // 先获取文本，再尝试解析JSON
    const text = await response.text()
    console.log('🔐 [批准命令] 后端响应:', { status: response.status, text: text.substring(0, 200) })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: text || '批准命令失败' },
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
    console.error('批准命令失败:', error)
    return NextResponse.json(
      { success: false, message: error.message || '批准命令失败' },
      { status: 500 }
    )
  }
}
