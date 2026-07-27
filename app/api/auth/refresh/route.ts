import { NextRequest, NextResponse } from 'next/server'
import { generateTokens, verifyRefreshToken } from '../../../../lib/auth/jwt-edge'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete('accessToken')
  response.cookies.delete('refreshToken')
}

function cookieOptions(request: NextRequest) {
  const isHttps = request.headers.get('x-forwarded-proto') === 'https'
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && isHttps,
    sameSite: 'lax' as const,
    path: '/'
  }
}

/** 使用持久化会话轮换访问令牌和刷新令牌。旧令牌在事务提交后立即失效。 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ success: false, error: '刷新令牌缺失', code: 'REFRESH_TOKEN_MISSING' }, { status: 401 })
  }

  try {
    const payload = await verifyRefreshToken(refreshToken)
    const prisma = await getPrismaClient()
    const session = await prisma.authSession.findFirst({
      where: {
        refreshTokenId: payload.jti,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    })

    if (!session || !session.user.isActive || session.user.approvalStatus !== 'approved') {
      const response = NextResponse.json({ success: false, error: '会话已失效', code: 'SESSION_REVOKED' }, { status: 401 })
      clearAuthCookies(response)
      return response
    }

    const rememberMe = session.expiresAt.getTime() - session.createdAt.getTime() > 8 * 24 * 60 * 60 * 1000
    const tokens = await generateTokens({
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      role: session.user.role,
      permissions: session.user.permissions || [],
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
      lastLoginAt: session.user.lastLoginAt || undefined,
      isActive: session.user.isActive
    }, { rememberMe })

    await prisma.$transaction([
      prisma.authSession.update({
        where: { id: session.id },
        data: { isActive: false, lastUsedAt: new Date() }
      }),
      prisma.authSession.create({
        data: {
          userId: session.userId,
          refreshTokenId: tokens.refreshTokenId,
          userAgent: request.headers.get('user-agent') || session.userAgent,
          ipAddress: request.ip || request.headers.get('x-forwarded-for') || session.ipAddress,
          expiresAt: new Date(tokens.refreshExpiresAt),
          lastUsedAt: new Date()
        }
      })
    ])

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: session.user.id,
          username: session.user.username,
          email: session.user.email,
          role: session.user.role,
          permissions: session.user.permissions || []
        },
        expiresAt: new Date(tokens.expiresAt).toISOString()
      }
    })
    const options = cookieOptions(request)
    response.cookies.set('accessToken', tokens.accessToken, {
      ...options,
      maxAge: Math.max(0, Math.floor((tokens.expiresAt - Date.now()) / 1000))
    })
    response.cookies.set('refreshToken', tokens.refreshToken, {
      ...options,
      maxAge: Math.max(0, Math.floor((tokens.refreshExpiresAt - Date.now()) / 1000))
    })
    return response
  } catch (error) {
    console.warn('刷新会话失败:', error instanceof Error ? error.message : error)
    const response = NextResponse.json({ success: false, error: '令牌无效或已过期', code: 'INVALID_TOKEN' }, { status: 401 })
    clearAuthCookies(response)
    return response
  }
}

/** 检查刷新令牌及其数据库会话是否仍然有效。 */
export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ success: true, data: { valid: false, reason: 'REFRESH_TOKEN_MISSING' } })
  }

  try {
    const payload = await verifyRefreshToken(refreshToken)
    const prisma = await getPrismaClient()
    const session = await prisma.authSession.findFirst({
      where: { refreshTokenId: payload.jti, isActive: true, expiresAt: { gt: new Date() } },
      select: { expiresAt: true }
    })
    return NextResponse.json({
      success: true,
      data: session
        ? { valid: true, expiresAt: session.expiresAt.toISOString() }
        : { valid: false, reason: 'SESSION_REVOKED' }
    })
  } catch {
    return NextResponse.json({ success: true, data: { valid: false, reason: 'INVALID_REFRESH_TOKEN' } })
  }
}
