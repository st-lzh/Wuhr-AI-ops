import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../lib/config/database'
import { verifyToken } from '../../../../lib/auth/jwt-edge'

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 用户退出登录请求')

    // 尝试获取当前用户信息以便记录
    const accessToken = request.cookies.get('accessToken')?.value
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (accessToken || refreshToken) {
      try {
        const prisma = await getPrismaClient()

        // 由于已禁用refresh token功能，这里不需要处理refresh token
        // 只需要清除cookies即可
      } catch (error) {
        console.warn('清理会话时出错:', error)
      }
    }

    const response = NextResponse.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    })

    // 清除所有认证相关的cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
      // 在开发环境下不设置domain，允许跨IP访问
      ...(process.env.NODE_ENV === 'production' && { domain: process.env.COOKIE_DOMAIN })
    }

    response.cookies.set('accessToken', '', cookieOptions)
    response.cookies.set('refreshToken', '', cookieOptions)
    response.cookies.set('token', '', cookieOptions) // 兼容旧版本

    console.log('✅ 用户已成功退出登录')
    return response

  } catch (error) {
    console.error('❌ 退出登录处理错误:', error)

    // 即使出错也要清除cookies
    const response = NextResponse.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    })

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0
    }

    response.cookies.set('accessToken', '', cookieOptions)
    response.cookies.set('refreshToken', '', cookieOptions)
    response.cookies.set('token', '', cookieOptions)

    return response
  }
}