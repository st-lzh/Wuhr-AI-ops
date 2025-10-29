// 认证API辅助工具
import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { verifyToken } from './jwt-edge'
import { getPrismaClient } from '../config/database'
import { ApiResponse, AuthError } from '../../app/types/api'

// 简化的数据库实例
export const db = {} as any

// 标准API响应格式
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  details?: string,
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success,
    data,
    error,
    details,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(response, { status })
}

// 成功响应
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return createResponse(true, data, undefined, undefined, status)
}

// 错误响应
export function errorResponse(
  error: string,
  details?: string,
  status: number = 400
): NextResponse {
  return createResponse(false, undefined, error, details, status)
}

// 服务器错误响应
export function serverErrorResponse(error: any): NextResponse {
  console.error('API错误:', error)
  return createResponse(
    false,
    undefined,
    '服务器内部错误',
    error instanceof Error ? error.message : 'Unknown error',
    500
  )
}

// 请求验证中间件
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json()
    const validatedData = schema.parse(body)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(err => {
        let friendlyMessage = err.message

        // 为常见的验证错误提供更友好的信息
        if (err.path.includes('password') && err.code === 'invalid_string') {
          if (err.message.includes('大小写字母和数字')) {
            friendlyMessage = '密码必须包含至少一个大写字母、一个小写字母和一个数字'
          }
        }

        if (err.path.includes('email') && err.code === 'invalid_string') {
          friendlyMessage = '请输入有效的邮箱地址'
        }

        if (err.path.includes('username') && err.code === 'too_small') {
          friendlyMessage = '用户名至少需要3个字符'
        }

        if (err.path.includes('realName') && err.code === 'too_small') {
          friendlyMessage = '真实姓名至少需要2个字符'
        }

        if (err.path.includes('reason') && err.code === 'too_small') {
          friendlyMessage = '申请理由至少需要10个字符，请详细说明您的使用目的'
        }

        return {
          field: err.path.join('.'),
          message: friendlyMessage
        }
      })

      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: '注册信息填写有误',
          details: JSON.stringify(errors),
          timestamp: new Date().toISOString()
        }, { status: 400 })
      }
    }
    
    return {
      success: false,
      response: errorResponse('请求格式错误', undefined, 400)
    }
  }
}

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

    // 获取用户信息
    const prisma = await getPrismaClient()
    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        isActive: true
      }
    })

    if (!user) {
      return {
        success: false,
        response: NextResponse.json({
          success: false,
          error: '用户不存在或已被禁用',
          timestamp: new Date().toISOString()
        }, { status: 401 })
      }
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

// 权限检查中间件
export async function requirePermission(
  request: NextRequest,
  requiredPermission: string
): Promise<
  { success: true; user: any } | 
  { success: false; response: NextResponse }
> {
  const authResult = await requireAuth(request)
  
  if (!authResult.success) {
    return authResult
  }

  const { user } = authResult

  // 硬编码超级管理员：admin@wuhr.ai 拥有所有权限
  if (user.email === 'admin@wuhr.ai') {
    return { success: true, user: { ...user, role: 'admin' } }
  }

  if (!user.permissions.includes(requiredPermission) && user.role !== 'admin') {
    return {
      success: false,
      response: errorResponse('权限不足', `需要权限: ${requiredPermission}`, 403)
    }
  }

  return { success: true, user }
}

// 简单的内存频率限制器
class RateLimiter {
  private requests = new Map<string, number[]>()
  private limit: number
  private windowMs: number

  constructor(limit: number = 10, windowMs: number = 60000) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(key: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    if (!this.requests.has(key)) {
      this.requests.set(key, [now])
      return true
    }

    const requestTimes = this.requests.get(key)!
    
    // 清理过期请求
    const validRequests = requestTimes.filter(time => time > windowStart)
    
    if (validRequests.length >= this.limit) {
      return false
    }

    validRequests.push(now)
    this.requests.set(key, validRequests)
    return true
  }

  reset(key: string) {
    this.requests.delete(key)
  }
}

// 全局频率限制器实例
export const authRateLimiter = new RateLimiter(5, 60000) // 5次/分钟
export const generalRateLimiter = new RateLimiter(30, 60000) // 30次/分钟

// 频率限制中间件
export function rateLimit(
  limiter: RateLimiter,
  getKey: (request: NextRequest) => string = (req) => req.ip || 'unknown'
) {
  return (request: NextRequest): NextResponse | null => {
    const key = getKey(request)
    
    if (!limiter.check(key)) {
      return errorResponse(
        '请求过于频繁',
        '请稍后再试',
        429
      )
    }

    return null
  }
}

// 记录认证日志
export async function logAuthEvent(
  action: 'login' | 'logout' | 'register' | 'password_change' | 'failed_login' | 'token_refresh',
  request: NextRequest,
  userId?: string,
  username?: string,
  success: boolean = true,
  details?: string
) {
  try {
    const prisma = await getPrismaClient()

    // 构建数据对象，只在userId有效时才包含它
    const logData: any = {
      username,
      action,
      success,
      ipAddress: request.ip || request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details,
      timestamp: new Date()
    }

    // 只有当userId存在且不为空时才添加到数据中
    if (userId && userId.trim() !== '') {
      // 验证userId是否存在于User表中
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      })

      if (userExists) {
        logData.userId = userId
      }
    }

    await prisma.authLog.create({
      data: logData
    })
  } catch (error) {
    console.error('记录认证日志失败:', error)
  }
}

// 生成安全的错误消息（避免信息泄露）
export function createAuthError(
  code: string,
  message: string,
  field?: string
): AuthError {
  return { code, message, field }
}

// 常见认证错误
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: createAuthError('INVALID_CREDENTIALS', '用户名或密码错误'),
  USER_NOT_FOUND: createAuthError('USER_NOT_FOUND', '用户不存在'),
  USER_INACTIVE: createAuthError('USER_INACTIVE', '用户账户已被禁用'),
  USERNAME_EXISTS: createAuthError('USERNAME_EXISTS', '用户名已存在', 'username'),
  EMAIL_EXISTS: createAuthError('EMAIL_EXISTS', '邮箱已存在', 'email'),
  WEAK_PASSWORD: createAuthError('WEAK_PASSWORD', '密码强度不足', 'password'),
  PASSWORDS_MISMATCH: createAuthError('PASSWORDS_MISMATCH', '两次输入的密码不一致', 'confirmPassword'),
  INVALID_TOKEN: createAuthError('INVALID_TOKEN', '无效的认证令牌'),
  TOKEN_EXPIRED: createAuthError('TOKEN_EXPIRED', '认证令牌已过期'),
  INSUFFICIENT_PERMISSIONS: createAuthError('INSUFFICIENT_PERMISSIONS', '权限不足'),
  RATE_LIMITED: createAuthError('RATE_LIMITED', '请求过于频繁，请稍后再试'),
} as const

// 数据库初始化助手
export async function ensureDbInitialized() {
  try {
    // 初始化数据库连接
    // await dbProvider.initialize() // 暂时跳过

    // 设置Prisma客户端引用
    const { getPrismaClient: getPrismaClientFunc } = await import('../config/database');
    const prisma = await getPrismaClientFunc()
    ;(db as any).prisma = prisma

    // 使用Prisma客户端直接查询用户数量
    const userCount = await prisma.user.count()
    if (userCount === 0) {
      console.log('初始化认证数据库...')
      // 数据库已在initialize()中创建默认数据
    }
  } catch (error) {
    console.error('数据库初始化失败:', error)
    throw error
  }
}
