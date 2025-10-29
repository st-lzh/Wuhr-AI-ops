import * as jwt from 'jsonwebtoken'
import { generateUUID } from './uuid-edge'
import { AuthTokens, User, JWTPayload, AuthError, AUTH_ERRORS, AuthConfig } from './types'

// JWT配置 - 从环境变量获取，提供默认值用于开发
const getJWTConfig = (): AuthConfig => {
  return {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_EXPIRES_IN || '2h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  }
}

/**
 * 生成用户权限数组
 */
function getUserPermissions(role: User['role'], email?: string): string[] {
  // 硬编码超级管理员：admin@wuhr.ai 拥有所有权限
  if (email === 'admin@wuhr.ai') {
    return ['users:read', 'users:write', 'users:delete', 'cicd:all', 'servers:all', 'config:all', '*']
  }

  const permissions: Record<User['role'], string[]> = {
    admin: ['users:read', 'users:write', 'users:delete', 'cicd:all', 'servers:all', 'config:all'],
    manager: ['users:read', 'cicd:read', 'cicd:write', 'cicd:execute', 'servers:read', 'servers:write', 'config:read', 'config:write'],
    developer: ['users:read', 'cicd:read', 'cicd:execute', 'servers:read', 'config:read'],
    viewer: ['users:read', 'cicd:read', 'servers:read', 'config:read']
  }
  return permissions[role] || []
}

/**
 * 生成JWT Token对（访问令牌 + 刷新令牌）
 */
export async function generateTokens(user: User): Promise<AuthTokens> {
  try {
    const config = getJWTConfig()
    
    if (!config.jwtSecret) {
      throw new AuthError('JWT密钥未配置', 'JWT_SECRET_MISSING', 500)
    }
    
    const now = Math.floor(Date.now() / 1000)
    const permissions = getUserPermissions(user.role, user.email)
    
    // 生成访问令牌
    const accessPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
      type: 'access',
      iat: now,
      exp: now + parseExpiry(config.accessTokenExpiry)
    }
    
    const accessToken = jwt.sign(accessPayload, config.jwtSecret, {
      algorithm: 'HS256'
    })
    
    // 生成刷新令牌
    const refreshTokenId = generateUUID()
    const refreshPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions,
      type: 'refresh',
      jti: refreshTokenId,
      iat: now,
      exp: now + parseExpiry(config.refreshTokenExpiry)
    }
    
    const refreshToken = jwt.sign(refreshPayload, config.jwtSecret, {
      algorithm: 'HS256'
    })
    
    return {
      accessToken,
      refreshToken,
      expiresAt: accessPayload.exp * 1000, // 转换为毫秒
      refreshExpiresAt: refreshPayload.exp * 1000
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    
    console.error('生成JWT Token失败:', error)
    throw new AuthError('Token生成失败', 'TOKEN_GENERATION_ERROR', 500)
  }
}

/**
 * 验证访问令牌
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  try {
    const config = getJWTConfig()
    
    if (!token) {
      throw new AuthError('Token不能为空', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256']
    }) as JWTPayload
    
    // 验证Token类型
    if (decoded.type !== 'access') {
      throw new AuthError('无效的Token类型', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    // 验证是否过期
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp <= now) {
      throw new AuthError('Token已过期', AUTH_ERRORS.TOKEN_EXPIRED, 401)
    }
    
    return decoded
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('无效的Token', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token已过期', AUTH_ERRORS.TOKEN_EXPIRED, 401)
    }
    
    if (error instanceof AuthError) {
      throw error
    }

    // 静默处理token验证失败
    throw new AuthError('Token验证失败', AUTH_ERRORS.INVALID_TOKEN, 401)
  }
}

/**
 * 验证刷新令牌
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  try {
    const config = getJWTConfig()
    
    if (!token) {
      throw new AuthError('刷新Token不能为空', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256']
    }) as JWTPayload
    
    // 验证Token类型
    if (decoded.type !== 'refresh') {
      throw new AuthError('无效的刷新Token类型', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    // 验证是否过期
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp <= now) {
      throw new AuthError('刷新Token已过期', AUTH_ERRORS.TOKEN_EXPIRED, 401)
    }
    
    return decoded
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('无效的刷新Token', AUTH_ERRORS.INVALID_TOKEN, 401)
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('刷新Token已过期', AUTH_ERRORS.TOKEN_EXPIRED, 401)
    }
    
    if (error instanceof AuthError) {
      throw error
    }

    // 静默处理刷新token验证失败
    throw new AuthError('刷新Token验证失败', AUTH_ERRORS.INVALID_TOKEN, 401)
  }
}

/**
 * 使用刷新令牌生成新的Token对
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  try {
    // 验证刷新令牌
    const decoded = await verifyRefreshToken(refreshToken)
    
    // 构造用户对象用于生成新Token
    const user: User = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
    
    // 生成新的Token对
    const newTokens = await generateTokens(user)
    
    return newTokens
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    
    console.error('刷新Token失败:', error)
    throw new AuthError('Token刷新失败', 'TOKEN_REFRESH_ERROR', 401)
  }
}

/**
 * 解码Token（不验证，仅用于调试）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    return decoded
  } catch (error) {
    console.error('解码Token失败:', error)
    return null
  }
}

/**
 * 检查Token是否即将过期（剩余时间少于5分钟）
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const decoded = decodeToken(token)
    if (!decoded) return true
    
    const now = Math.floor(Date.now() / 1000)
    const timeRemaining = decoded.exp - now
    
    // 5分钟 = 300秒
    return timeRemaining < 300
  } catch (error) {
    return true
  }
}

/**
 * 解析过期时间字符串为秒数
 */
function parseExpiry(expiry: string): number {
  const timeUnits: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800
  }
  
  const match = expiry.match(/^(\d+)([smhdw])$/)
  if (!match) {
    throw new Error(`无效的过期时间格式: ${expiry}`)
  }
  
  const [, value, unit] = match
  const multiplier = timeUnits[unit]
  
  if (!multiplier) {
    throw new Error(`不支持的时间单位: ${unit}`)
  }
  
  return parseInt(value) * multiplier
}

/**
 * 从Authorization头提取Token
 */
export function extractTokenFromHeader(authorization: string | null): string | null {
  if (!authorization) return null
  
  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }
  
  return parts[1]
}

/**
 * 创建Token对（API兼容性函数）
 */
export async function createTokens(userInfo: { userId: string; username: string; role: string }, rememberMe: boolean = false): Promise<{
  accessToken: string
  refreshToken: string
  refreshTokenId: string
  expiresIn: number
  refreshExpiresAt: Date
}> {
  const user: User = {
    id: userInfo.userId,
    username: userInfo.username,
    email: '', // 在API中会从数据库获取
    role: userInfo.role as any,
    permissions: getUserPermissions(userInfo.role as any, ''),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  }

  const tokens = await generateTokens(user)
  
  // 如果是"记住我"，延长刷新令牌的有效期
  if (rememberMe) {
    const config = getJWTConfig()
    const extendedExpiry = parseExpiry('30d') // 30天
    const now = Math.floor(Date.now() / 1000)
    
    const refreshPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      type: 'refresh',
      jti: generateUUID(),
      iat: now,
      exp: now + extendedExpiry
    }
    
    tokens.refreshToken = jwt.sign(refreshPayload, config.jwtSecret, {
      algorithm: 'HS256'
    })
    tokens.refreshExpiresAt = refreshPayload.exp * 1000
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    refreshTokenId: (jwt.decode(tokens.refreshToken) as any)?.jti || generateUUID(),
    expiresIn: 15 * 60, // 15分钟，单位秒
    refreshExpiresAt: new Date(tokens.refreshExpiresAt)
  }
}

/**
 * 验证Token（通用函数）
 */
export async function verifyToken(token: string, type: 'access' | 'refresh'): Promise<{
  userId: string
  username: string
  role: string
  tokenId?: string
} | null> {
  try {
    if (type === 'access') {
      const decoded = await verifyAccessToken(token)
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    } else {
      const decoded = await verifyRefreshToken(token)
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        tokenId: decoded.jti
      }
    }
  } catch (error) {
    // 静默处理token验证失败
    return null
  }
} 