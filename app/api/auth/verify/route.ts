import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 验证认证状态
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      // 如果认证失败，返回无效状态
      return NextResponse.json({
        success: true,
        data: {
          valid: false
        },
        timestamp: new Date().toISOString()
      })
    }

    const { user } = authResult

    // 构建验证成功响应
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Token验证API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器错误',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}