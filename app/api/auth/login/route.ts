import { NextRequest, NextResponse } from 'next/server'
import { generateTokens } from '../../../../lib/auth/jwt-edge'
import { getPrismaClient } from '../../../../lib/config/database'
import { withLeakDetection } from '../../../../lib/database/leakDetector'

export async function POST(request: NextRequest) {
  return await withLeakDetection('user-login', async () => {
    try {
      const body = await request.json()
      const { username, password, rememberMe = false } = body

      console.log('🔐 Login attempt:', { username, rememberMe })

      // 添加连接超时保护
      const prisma = await Promise.race([
        getPrismaClient(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('获取数据库连接超时')), 8000)
        )
      ]);

      // Find user by email or username
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: username },
            { username: username }
          ]
        }
      })

    if (!user) {
      // 如果没有找到用户，检查是否有待审批的注册申请
      const registration = await prisma.userRegistration.findFirst({
        where: {
          OR: [
            { email: username },
            { username: username }
          ]
        }
      })

      if (registration) {
        if (registration.status === 'PENDING') {
          return NextResponse.json({
            success: false,
            error: '您的注册申请正在等待管理员审批，请耐心等待'
          }, { status: 401 })
        } else if (registration.status === 'REJECTED') {
          return NextResponse.json({
            success: false,
            error: '您的注册申请已被拒绝，请联系管理员了解详情'
          }, { status: 401 })
        }
      }

      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 })
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json({
        success: false,
        error: '账户已被禁用，请联系管理员'
      }, { status: 401 })
    }

    // Check approval status
    if (user.approvalStatus === 'pending') {
      return NextResponse.json({
        success: false,
        error: '您的账户正在等待管理员审批，请耐心等待'
      }, { status: 401 })
    }

    if (user.approvalStatus === 'rejected') {
      return NextResponse.json({
        success: false,
        error: '您的账户审批被拒绝，请联系管理员了解详情'
      }, { status: 401 })
    }

    // Verify password
    const bcrypt = require('bcryptjs')
    const isValid = await bcrypt.compare(password, user.password)
    
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 })
    }

    // 访问令牌和刷新令牌共用同一个会话 ID，便于服务端撤销。
    const tokens = await generateTokens({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt || undefined,
      isActive: user.isActive
    }, { rememberMe })

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Create session record
    await prisma.authSession.create({
      data: {
        id: require('crypto').randomUUID(),
        userId: user.id,
        refreshTokenId: tokens.refreshTokenId,
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
        expiresAt: new Date(tokens.refreshExpiresAt),
        lastUsedAt: new Date()
      }
    })

    console.log('Login successful:', {
      userId: user.id,
      username: user.username,
      rememberMe
    })

    // Build response
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
          lastLoginAt: user.lastLoginAt
        },
        tokens: {
          accessToken: tokens.accessToken,
          expiresIn: Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000))
        }
      },
      timestamp: new Date().toISOString()
    })

    // Set secure HTTP-only cookies - 根据环境动态设置
    // 🔥 改进: 检测实际协议，而不仅依赖 NODE_ENV
    const isProduction = process.env.NODE_ENV === 'production'
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const isHttps = forwardedProto === 'https'

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction && isHttps, // 只在生产环境且HTTPS下使用secure
      sameSite: 'lax' as const,
      path: '/',
      domain: undefined // 明确不设置domain
    }

    console.log('🍪 Setting cookie with options:', {
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      httpOnly: cookieOptions.httpOnly,
      isProduction,
      isHttps
    })

    response.cookies.set('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000))
    })
    response.cookies.set('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: Math.max(0, Math.floor((tokens.refreshExpiresAt - Date.now()) / 1000))
    })

    return response

    } catch (error) {
      console.error('🚨 Login error:', error)

      const errorMessage = error instanceof Error ? error.message : 'Login failed'
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
  })
}
