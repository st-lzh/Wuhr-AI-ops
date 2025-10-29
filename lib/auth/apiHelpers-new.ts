// 认证API辅助工具
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './jwt-edge'
import { getPrismaClient } from '../config/database'

// 用户缓存，减少数据库查询
const userCache = new Map<string, { user: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

// 认证中间件
export async function requireAuth(
  request: NextRequest
): Promise<
  { success: true; user: any } | 
  { success: false; response: NextResponse }
> {
  try {
    // 首先尝试从Authorization头部获取token
    let token = null
    const authHeader = request.headers.get('authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // 如果没有Authorization头部，尝试从cookie获取
      token = request.cookies.get('accessToken')?.value
    }
    
    if (!token) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: '缺少认证令牌',
          timestamp: new Date().toISOString()
        }, { status: 401 })
      }
    }

    const decoded = await verifyToken(token, 'access')
    
    if (!decoded) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: '认证令牌无效',
          timestamp: new Date().toISOString()
        }, { status: 401 })
      }
    }

    // 检查用户缓存
    const cacheKey = decoded.userId
    const cached = userCache.get(cacheKey)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // 使用缓存的用户信息
      return { success: true, user: cached.user }
    }

    // 获取用户信息
    const prisma = await getPrismaClient()
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true
      }
    })

    if (!user) {
      // 清除可能的过期缓存
      userCache.delete(cacheKey)
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: '用户不存在或已被禁用',
          timestamp: new Date().toISOString()
        }, { status: 401 })
      }
    }

    // 更新缓存
    userCache.set(cacheKey, { user, timestamp: now })

    // 定期清理过期缓存
    if (userCache.size > 100) {
      // 使用Array.from来避免迭代器类型问题
      Array.from(userCache.entries()).forEach(([key, value]) => {
        if ((now - value.timestamp) > CACHE_TTL) {
          userCache.delete(key)
        }
      })
    }

    return { success: true, user }
  } catch (error) {
    console.error('认证验证失败:', error)
    return {
      success: false,
      response: NextResponse.json({
        success: false,
        error: '认证验证失败',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }
  }
}
