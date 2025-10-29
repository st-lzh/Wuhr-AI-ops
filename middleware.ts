import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './lib/auth/jwt-edge'

// 定义路由保护规则 - 只有这些路径是公开的
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/auth',
  '/api/auth/login',
  '/api/auth/register',

  '/api/version',
  '/api/models',
  '/api/test-provider',
  '/api/health',
  '/test-http-api'
]

// 角色权限映射
const ROLE_PATHS = {
  admin: ['/admin', '/config', '/monitor', '/servers', '/tools', '/ai', '/'],
  manager: ['/monitor', '/servers', '/tools', '/ai', '/'],
  developer: ['/tools', '/ai', '/'],
  viewer: ['/monitor', '/ai', '/'],
}

/**
 * 检查路径是否为公开路径
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  )
}

/**
 * 检查用户是否有权限访问路径
 */
function hasPermissionForPath(pathname: string, role: string): boolean {
  // 管理员可以访问所有路径
  if (role === 'admin') return true
  
  // 检查角色权限
  const allowedPaths = ROLE_PATHS[role as keyof typeof ROLE_PATHS] || []
  return allowedPaths.some(path => pathname === '/' ? path === '/' : pathname.startsWith(path))
}

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
 * 创建重定向响应
 */
function createRedirectResponse(request: NextRequest, redirectTo: string): NextResponse {
  const returnUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
  const loginUrl = new URL(`${redirectTo}?returnUrl=${returnUrl}`, request.url)
  return NextResponse.redirect(loginUrl)
}

/**
 * 创建API错误响应
 */
function createApiErrorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }, { status })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 跳过静态资源和内部Next.js路径
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 公开路径直接通过
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 其他所有路径都需要认证（包括根路径"/"）
  const token = extractTokenFromRequest(request)
  
  if (!token) {
    // 未认证用户处理
    if (pathname.startsWith('/api/')) {
      return createApiErrorResponse(401, 'Authentication required')
    }
    return createRedirectResponse(request, '/login')
  }

  try {
    // 验证Token并获取用户信息
    const payload = await verifyToken(token, 'access')
    
    if (!payload || !payload.userId) {
      throw new Error('Invalid token payload')
    }

    // 检查用户角色权限
    const userRole = payload.role || 'viewer'
    
    if (!hasPermissionForPath(pathname, userRole)) {
      // 权限不足处理
      if (pathname.startsWith('/api/')) {
        return createApiErrorResponse(403, 'Insufficient permissions')
      }
      return createRedirectResponse(request, '/auth/403')
    }

    // 添加用户信息到请求头，供后续处理使用
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.userId)
    requestHeaders.set('x-user-role', userRole)
    requestHeaders.set('x-user-email', payload.username || '')

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })

  } catch (error) {
    // 静默处理token验证失败，不输出错误日志

    // Token无效或过期
    if (pathname.startsWith('/api/')) {
      return createApiErrorResponse(401, 'Invalid or expired token')
    }

    // 清除无效cookie并重定向到登录页
    const response = createRedirectResponse(request, '/login')
    response.cookies.delete('accessToken')


    return response
  }
}

// 配置中间件匹配规则
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * 1. /_next/static (静态文件)
     * 2. /_next/image (图像优化)
     * 3. /favicon.ico, /sitemap.xml 等静态资源
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
