import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { canWriteTeamAssets } from '../../../../lib/auth/teamAccess'

// 后端 base URL：从 server-side env IMPROVE_API_BASE_URL 取（与 lib/improve/backendProxy.ts 一致）
// 默认 localhost:8888（开发用）；生产 .env.local 应设到实际 backend 入口（如 nginx 反代地址）
const BACKEND_BASE_URL = process.env.IMPROVE_API_BASE_URL || 'http://localhost:8888'

// 后端 admin API key；启用 --http-auth 时所有 /api/* 请求都需带这个 header
function backendHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.IMPROVE_API_KEY
  if (key) h['X-API-Key'] = key
  return h
}

// GET /api/config/security - 获取安全配置
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const backendUrl = `${BACKEND_BASE_URL}/api/config/security`

    console.log(`📡 [Security Config] 获取安全配置: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: backendHeaders(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [Security Config] 后端请求失败:`, errorText)
      return NextResponse.json(
        {
          success: false,
          error: `Backend request failed: ${response.statusText}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`✅ [Security Config] 获取成功:`, data)

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ [Security Config] 获取失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/config/security - 更新安全配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    if (!canWriteTeamAssets(authResult.user, 'config:write')) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }
    const body = await request.json()
    const backendUrl = `${BACKEND_BASE_URL}/api/config/security`

    console.log(`📡 [Security Config] 更新安全配置: ${backendUrl}`, body)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [Security Config] 后端更新失败:`, errorText)
      return NextResponse.json(
        {
          success: false,
          error: `Backend request failed: ${response.statusText}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log(`✅ [Security Config] 更新成功:`, data)

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ [Security Config] 更新失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
