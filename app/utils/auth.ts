import { NextRequest } from 'next/server'
import { verifyToken as jwtVerifyToken } from '../../lib/auth/jwt'
import { getPrismaClient } from '../../lib/config/database'

/**
 * 从请求中提取Token
 */
function extractTokenFromRequest(request: NextRequest): string | null {
  // 先尝试从Authorization头获取
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // 再尝试从Cookie获取
  return request.cookies.get('accessToken')?.value || null
}

/**
 * 验证请求中的Token并返回用户信息
 */
export async function verifyToken(request: NextRequest): Promise<{
  id: string
  userId: string
  username: string
  email: string
  role: string
} | null> {
  try {
    const token = extractTokenFromRequest(request)
    
    if (!token) {
      return null
    }

    // 验证JWT Token
    const decoded = await jwtVerifyToken(token, 'access')
    
    if (!decoded) {
      return null
    }

    // 获取完整的用户信息
    const prisma = await getPrismaClient()
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true
      }
    })

    if (!user) {
      return null
    }

    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  } catch (error) {
    console.error('Token验证失败:', error)
    return null
  }
}
