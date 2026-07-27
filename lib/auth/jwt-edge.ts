import { SignJWT, jwtVerify } from 'jose'
import { AuthTokens, User, JWTPayload, AuthError, AUTH_ERRORS, AuthConfig } from './types'

const DEVELOPMENT_JWT_SECRET = 'wuhr-ai-ops-development-only-secret-change-me'

// JWT配置：生产环境必须显式提供密钥，避免错误配置时退回公开默认值。
function getJWTConfig(): AuthConfig {
  const configuredSecret = process.env.JWT_SECRET?.trim()
  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    throw new AuthError('生产环境必须配置 JWT_SECRET', 'JWT_SECRET_MISSING', 500)
  }

  const config = {
    jwtSecret: configuredSecret || DEVELOPMENT_JWT_SECRET,
    accessTokenExpiry: process.env.JWT_EXPIRES_IN || '2h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    bcryptRounds: 12
  }

  return config
}

/**
 * 解析过期时间字符串为秒数
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/)
  if (!match) return 900 // 默认15分钟
  
  const [, num, unit] = match
  const value = parseInt(num)
  
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return 900
  }
}

/**
 * 根据用户角色获取权限列表
 */
function getUserPermissions(role: string): string[] {
  const rolePermissions = {
    admin: ['users:read', 'users:write', 'users:delete', 'cicd:all', 'servers:all', 'config:all'],
    manager: ['users:read', 'cicd:read', 'cicd:write', 'servers:read', 'servers:write'],
    developer: ['cicd:read', 'servers:read'],
    viewer: ['servers:read']
  }
  
  return rolePermissions[role as keyof typeof rolePermissions] || []
}

/**
 * 生成JWT tokens
 */
export async function generateTokens(
  user: User,
  options: { rememberMe?: boolean; refreshTokenId?: string } = {}
): Promise<AuthTokens> {
  try {
    const config = getJWTConfig()

    if (!config.jwtSecret) {
      throw new AuthError('JWT密钥未配置', 'JWT_SECRET_MISSING', 500)
    }

    const now = Math.floor(Date.now() / 1000)
    // 优先使用用户实际权限，如果没有则使用角色默认权限
    const permissions = user.permissions && user.permissions.length > 0
      ? user.permissions
      : getUserPermissions(user.role)
    const secret = new TextEncoder().encode(config.jwtSecret)

    const refreshTokenId = options.refreshTokenId || crypto.randomUUID()
    const accessExpiresIn = parseExpiry(config.accessTokenExpiry)
    const refreshExpiresIn = options.rememberMe ? parseExpiry('30d') : parseExpiry(config.refreshTokenExpiry)

    // 访问令牌和刷新令牌共享同一个 jti，用于绑定数据库会话。
    const accessToken = await new SignJWT({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
      type: 'access',
      jti: refreshTokenId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + accessExpiresIn)
      .sign(secret)

    const refreshToken = await new SignJWT({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
      type: 'refresh',
      jti: refreshTokenId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + refreshExpiresIn)
      .sign(secret)

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
      expiresAt: (now + accessExpiresIn) * 1000,
      refreshExpiresAt: (now + refreshExpiresIn) * 1000
    }
  } catch (error) {
    console.error('生成Token失败:', error)
    throw new AuthError('Token生成失败', AUTH_ERRORS.TOKEN_GENERATION_FAILED, 500)
  }
}

/**
 * 验证访问令牌
 */
export async function verifyAccessToken(token: string) {
  try {
    const config = getJWTConfig()
    const secret = new TextEncoder().encode(config.jwtSecret)
    
    const { payload } = await jwtVerify(token, secret)
    
    // 验证Token类型
    if (payload.type !== 'access') {
      throw new AuthError('无效的Token类型', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    return payload as unknown as JWTPayload
  } catch (error) {
    // 静默处理token验证失败
    throw new AuthError('Token验证失败', AUTH_ERRORS.INVALID_TOKEN, 401)
  }
}

/** 验证刷新令牌，调用方还必须校验对应数据库会话仍处于启用状态。 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  try {
    const config = getJWTConfig()
    const secret = new TextEncoder().encode(config.jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new AuthError('无效的刷新令牌', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    return payload as unknown as JWTPayload
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError('刷新令牌验证失败', AUTH_ERRORS.INVALID_TOKEN, 401)
  }
}



/**
 * 验证Token（通用函数）
 */
export async function verifyToken(token: string, type: 'access'): Promise<{
  userId: string
  username: string
  role: string
  email?: string
  permissions: string[]
  tokenId?: string
} | null> {
  try {
    const payload = await verifyAccessToken(token)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as string,
      email: payload.email as string,
      permissions: Array.isArray(payload.permissions) ? payload.permissions as string[] : [],
      tokenId: payload.jti
    }
  } catch (error) {
    // 静默处理token验证失败
    return null
  }
}

/**
 * 解码Token（不验证）
 */
export function decodeToken(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    return null
  }
}
