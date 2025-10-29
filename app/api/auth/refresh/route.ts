import { NextRequest, NextResponse } from 'next/server'
import { refreshTokens, verifyRefreshToken } from '../../../../lib/auth/jwt'

// 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/refresh - 刷新访问令牌
 * 
 * 使用刷新令牌获取新的访问令牌和刷新令牌对
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Token刷新请求')

    // 从Cookie中获取刷新令牌
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      console.log('❌ 刷新令牌缺失')
      return NextResponse.json({
        success: false,
        error: '刷新令牌缺失',
        code: 'REFRESH_TOKEN_MISSING',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // 验证刷新令牌
    let decoded
    try {
      decoded = await verifyRefreshToken(refreshToken)
    } catch (error) {
      console.log('❌ 刷新令牌验证失败:', error instanceof Error ? error.message : '未知错误')
      
      // 清除无效的刷新令牌Cookie
      const response = NextResponse.json({
        success: false,
        error: '刷新令牌无效或已过期',
        code: 'INVALID_REFRESH_TOKEN',
        timestamp: new Date().toISOString()
      }, { status: 401 })
      
      response.cookies.delete('refreshToken')
      response.cookies.delete('accessToken')
      
      return response
    }

    // 使用刷新令牌生成新的令牌对
    const newTokens = await refreshTokens(refreshToken)

    console.log('✅ Token刷新成功:', {
      userId: decoded.userId,
      username: decoded.username,
      expiresAt: new Date(newTokens.expiresAt).toISOString()
    })

    // 创建响应
    const response = NextResponse.json({
      success: true,
      message: 'Token刷新成功',
      data: {
        user: {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
          permissions: decoded.permissions
        },
        expiresAt: newTokens.expiresAt,
        refreshExpiresAt: newTokens.refreshExpiresAt
      },
      timestamp: new Date().toISOString()
    })

    // 设置新的Token到HttpOnly Cookie
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/'
    }

    // 设置访问令牌Cookie（15分钟过期）
    response.cookies.set('accessToken', newTokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 // 15分钟
    })

    // 设置刷新令牌Cookie（7天过期）
    response.cookies.set('refreshToken', newTokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 // 7天
    })

    return response

  } catch (error) {
    console.error('❌ Token刷新失败:', error)

    // 处理错误
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const isTokenError = errorMessage.includes('token') || errorMessage.includes('Token') ||
                        errorMessage.includes('TOKEN') || errorMessage.includes('refresh')

    const response = NextResponse.json({
      success: false,
      error: isTokenError ? '令牌无效或已过期' : '服务器内部错误',
      code: isTokenError ? 'INVALID_TOKEN' : 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    }, { status: isTokenError ? 401 : 500 })

    // 如果是令牌相关错误，清除Cookie
    if (isTokenError) {
      response.cookies.delete('refreshToken')
      response.cookies.delete('accessToken')
    }

    return response
  }
}

/**
 * GET /api/auth/refresh - 检查刷新令牌状态
 * 
 * 用于检查当前刷新令牌是否有效
 */
export async function GET(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: 'REFRESH_TOKEN_MISSING'
        },
        timestamp: new Date().toISOString()
      })
    }

    // 验证刷新令牌
    try {
      const decoded = await verifyRefreshToken(refreshToken)
      
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          expiresAt: decoded.exp * 1000,
          user: {
            id: decoded.userId,
            username: decoded.username,
            email: decoded.email,
            role: decoded.role
          }
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: error instanceof Error ? 'INVALID_REFRESH_TOKEN' : 'UNKNOWN_ERROR'
        },
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ 检查刷新令牌状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
