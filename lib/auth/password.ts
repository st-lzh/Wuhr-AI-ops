import * as bcrypt from 'bcryptjs'
import { AuthError, AUTH_ERRORS } from './types'

// 密码加密配置
const BCRYPT_ROUNDS = 12

/**
 * 密码强度验证
 */
export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
} {
  const errors: string[] = []
  
  // 基本长度检查
  if (password.length < 8) {
    errors.push('密码长度至少8位')
  }
  
  if (password.length > 128) {
    errors.push('密码长度不能超过128位')
  }
  
  // 字符类型检查
  const hasLowercase = /[a-z]/.test(password)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  if (!hasLowercase) {
    errors.push('密码必须包含小写字母')
  }
  
  if (!hasUppercase) {
    errors.push('密码必须包含大写字母')
  }
  
  if (!hasNumbers) {
    errors.push('密码必须包含数字')
  }
  
  // 注释掉特殊字符要求，降低密码复杂度要求
  // if (!hasSpecialChar) {
  //   errors.push('密码必须包含特殊字符')
  // }
  
  // 常见弱密码检查
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'root', 'user', '000000'
  ]
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('不能使用常见的弱密码')
  }
  
  // 连续字符检查
  if (/(.)\1{3,}/.test(password)) {
    errors.push('不能包含连续重复的字符')
  }
  
  // 计算密码强度
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  const strengthScore = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChar].filter(Boolean).length
  
  if (strengthScore >= 4 && password.length >= 12) {
    strength = 'strong'
  } else if (strengthScore >= 3 && password.length >= 8) {
    strength = 'medium'
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  }
}

/**
 * 密码加密
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // 验证密码强度
    const validation = validatePassword(password)
    if (!validation.isValid) {
      throw new AuthError(
        `密码不符合要求: ${validation.errors.join(', ')}`,
        AUTH_ERRORS.WEAK_PASSWORD,
        400
      )
    }
    
    // 生成盐值并加密
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS)
    const hash = await bcrypt.hash(password, salt)
    
    return hash
  } catch (error) {
    if (error instanceof AuthError) {
      throw error
    }
    
    throw new AuthError(
      '密码加密失败',
      'PASSWORD_HASH_ERROR',
      500
    )
  }
}

/**
 * 密码验证
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) {
      return false
    }
    
    const isValid = await bcrypt.compare(password, hash)
    return isValid
  } catch (error) {
    console.error('密码验证失败:', error)
    return false
  }
}

/**
 * 生成随机密码
 */
export function generateRandomPassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  const allChars = lowercase + uppercase + numbers + special
  
  let password = ''
  
  // 确保至少包含每种类型的字符
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]
  
  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * 检查是否需要重新哈希密码（当加密强度升级时）
 */
export function needsRehash(hash: string): boolean {
  try {
    // bcrypt会自动检查rounds数是否匹配
    return !bcrypt.getRounds || bcrypt.getRounds(hash) < BCRYPT_ROUNDS
  } catch (error) {
    // 如果无法解析hash，可能是旧格式，需要重新哈希
    return true
  }
}

// 别名函数用于API兼容性
export const validatePasswordStrength = validatePassword 