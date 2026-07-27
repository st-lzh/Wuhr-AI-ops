import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '../../../../lib/config/database'
import { verifyRefreshToken, verifyToken } from '../../../../lib/auth/jwt-edge'

export async function POST(request: NextRequest) {
  try {
    console.log('🚪 用户退出登录请求')

    // 尝试获取当前用户信息以便记录
    const accessToken = request.cookies.get('accessToken')?.value
    const refreshToken = request.cookies.get('refreshToken')?.value

    if (accessToken || refreshToken) {
      try {
        const prisma = await getPrismaClient()
        let tokenId: string | undefined
        if (refreshToken) tokenId = (await verifyRefreshToken(refreshToken)).jti
        if (!tokenId && accessToken) tokenId = (await verifyToken(accessToken, 'access'))?.tokenId

        if (tokenId) {
          await prisma.authSession.updateMany({
            where: { refreshTokenId: tokenId, isActive: true },
            data: { isActive: false, lastUsedAt: new Date() }
          })
        }
      } catch (error) {
        console.warn('清理会话时出错:', error)
      }
    }

    const response = NextResponse.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    })

    // 清除所有认证相关的cookies - 使用 delete 方法
    response.cookies.delete('accessToken')
    response.cookies.delete('refreshToken')
    response.cookies.delete('token') // 兼容旧版本

    console.log('✅ 用户已成功退出登录，Cookie 已清除')
    return response

  } catch (error) {
    console.error('❌ 退出登录处理错误:', error)

    // 即使出错也要清除cookies
    const response = NextResponse.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    })

    response.cookies.delete('accessToken')
    response.cookies.delete('refreshToken')
    response.cookies.delete('token')

    return response
  }
}
