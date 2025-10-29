import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// 测试认证API
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 测试认证API被调用')
    
    // 检查认证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      console.log('❌ 认证失败:', authResult.response)
      return authResult.response
    }

    const { user } = authResult
    console.log('✅ 认证成功，用户信息:', {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    })

    return NextResponse.json({
      success: true,
      message: '认证测试成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 认证测试失败:', error)
    return NextResponse.json({
      success: false,
      error: '认证测试失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
