import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:2081'

// GET /api/mcp/tools - 获取MCP工具列表
export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [MCP API] 获取MCP工具列表')

    const response = await fetch(`${BACKEND_URL}/api/mcp/tools`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ [MCP API] 后端错误:', error)
      return NextResponse.json(
        { success: false, error: '获取MCP工具列表失败' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ [MCP API] 成功获取工具列表:', data.total)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('❌ [MCP API] 请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '网络请求失败',
      },
      { status: 500 }
    )
  }
}

// POST /api/mcp/tools?action=call - 调用MCP工具
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'call') {
      console.log('🚀 [MCP API] 调用MCP工具')

      const body = await request.json()

      const response = await fetch(`${BACKEND_URL}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('❌ [MCP API] 调用工具失败:', error)
        return NextResponse.json(
          { success: false, error: '调用工具失败' },
          { status: response.status }
        )
      }

      const data = await response.json()
      console.log('✅ [MCP API] 工具调用完成')

      return NextResponse.json(data)
    }

    return NextResponse.json(
      { success: false, error: '未知的操作' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('❌ [MCP API] 请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || '网络请求失败',
      },
      { status: 500 }
    )
  }
}
