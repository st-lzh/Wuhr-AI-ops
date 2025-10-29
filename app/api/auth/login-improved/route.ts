import { NextRequest, NextResponse } from 'next/server'
import { generateTokens } from '../../../../lib/auth/jwt-edge'
import { withDbConnection } from '../../../../lib/database/connectionManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, rememberMe = false } = body

    console.log('🔐 用户登录尝试:', { username, rememberMe })

    // 使用连接管理器执行数据库操作
    const result = await withDbConnection(async (prisma) => {
      // 尝试通过邮箱或用户名查找用户
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: username },
            { username: username }
          ]
        }
      })
      
      if (!user) {
        throw new Error('用户名或密码错误')
      }

      // 检查用户是否被禁用
      if (!user.isActive) {
        throw new Error('账户已被禁用，请联系管理员')
      }

      // 检查用户审批状态
      if (user.approvalStatus === 'pending') {
        throw new Error('您的账户正在等待管理员审批，请耐心等待')
      }

      if (user.approvalStatus === 'rejected') {
        throw new Error('您的账户审批被拒绝，请联系管理员了解详情')
      }

      // 验证密码
      const bcrypt = require('bcryptjs')
      const isValid = await bcrypt.compare(password, user.password)
      
      if (!isValid) {
        throw new Error('用户名或密码错误')
      }

      // 生成JWT tokens
      const { accessToken } = await generateTokens({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt || undefined,
        isActive: user.isActive
      })

      // 更新最后登录时间和创建会话记录
      const sessionId = require('crypto').randomUUID()
      
      await Promise.all([
        // 更新用户最后登录时间
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        }),
        
        // 创建会话记录
        prisma.authSession.create({
          data: {
            id: sessionId,
            userId: user.id,
            refreshTokenId: sessionId,
            userAgent: request.headers.get('user-agent') || 'unknown',
            ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
            expiresAt: new Date(Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)),
            lastUsedAt: new Date()
          }
        })
      ])

      return {
        user: {
          ...user,
          lastLoginAt: new Date()
        },
        accessToken
      }
    }, {
      operationName: 'user-login',
      timeout: 15000 // 15秒超时
    })

    console.log('✅ 用户登录成功:', {
      userId: result.user.id,
      username: result.user.username,
      rememberMe
    })

    // 构建响应
    const response = NextResponse.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          permissions: result.user.permissions || [],
          lastLoginAt: result.user.lastLoginAt
        },
        tokens: {
          accessToken: result.accessToken,
          expiresIn: 2 * 60 * 60 // 2小时
        }
      },
      timestamp: new Date().toISOString()
    })

    // 设置安全的HTTP-only cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/'
    }

    response.cookies.set('accessToken', result.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 // 15分钟
    })

    // 不设置refreshToken cookie，因为已禁用token刷新功能

    return response

  } catch (error) {
    console.error('❌ 用户登录失败:', error)
    
    // 根据错误类型返回适当的状态码
    const errorMessage = error instanceof Error ? error.message : '登录失败'
    const isAuthError = errorMessage.includes('用户名或密码错误') || 
                       errorMessage.includes('账户已被禁用') ||
                       errorMessage.includes('审批')
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: isAuthError ? 401 : 500 
    })
  }
}
