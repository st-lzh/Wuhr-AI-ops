import { NextRequest, NextResponse } from 'next/server'

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:2081'

// GET /api/config/security - 获取安全配置
export async function GET(request: NextRequest) {
  try {
    // 获取后端主机信息(从查询参数或默认值)
    const searchParams = request.nextUrl.searchParams
    const hostIp = searchParams.get('hostIp') || '47.99.137.248'
    const hostPort = searchParams.get('hostPort') || '2081'

    const backendUrl = `http://${hostIp}:${hostPort}/api/config/security`

    console.log(`📡 [Security Config] 获取安全配置: ${backendUrl}`)

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const body = await request.json()

    // 获取后端主机信息
    const searchParams = request.nextUrl.searchParams
    const hostIp = searchParams.get('hostIp') || '47.99.137.248'
    const hostPort = searchParams.get('hostPort') || '2081'

    const backendUrl = `http://${hostIp}:${hostPort}/api/config/security`

    console.log(`📡 [Security Config] 更新安全配置: ${backendUrl}`, body)

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
