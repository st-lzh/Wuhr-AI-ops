import { SignJWT, jwtVerify } from 'jose'
import { generateUUID } from './uuid-edge'
import { AuthTokens, User, JWTPayload, AuthError, AUTH_ERRORS, AuthConfig } from './types'

// JWT配置 - 从环境变量获取，提供默认值用于开发
function getJWTConfig(): AuthConfig {
  const config = {
    jwtSecret: process.env.JWT_SECRET || 'wuhr_ai_ops_jwt_secret_key_2024_very_secure',
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
export async function generateTokens(user: User): Promise<AuthTokens> {
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

    // 生成访问令牌
    const accessToken = await new SignJWT({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
      type: 'access'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + parseExpiry(config.accessTokenExpiry))
      .sign(secret)

    return {
      accessToken,
      expiresAt: now + parseExpiry(config.accessTokenExpiry)
    } as AuthTokens
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



/**
 * 验证Token（通用函数）
 */
export async function verifyToken(token: string, type: 'access'): Promise<{
  userId: string
  username: string
  role: string
  email?: string
} | null> {
  try {
    const payload = await verifyAccessToken(token)
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as string,
      email: payload.email as string
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
