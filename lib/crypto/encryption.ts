import crypto from 'crypto'

// 新写入的数据统一使用带认证标签的 AES-GCM；旧 CBC 密文只保留读取兼容。
const ALGORITHM = 'aes-256-gcm'
const LEGACY_ALGORITHM = 'aes-256-cbc'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const LEGACY_IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SECRET_PREFIX = 'wuhr:v2:'

let developmentKey: Buffer | null = null

// 从环境变量获取稳定加密密钥。生产环境缺少或配置错误时直接失败，
// 防止每次启动生成新密钥而让历史凭据永久不可恢复。
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY?.trim()
  if (keyString) {
    if (!/^[a-fA-F0-9]{64}$/.test(keyString)) {
      throw new Error('ENCRYPTION_KEY 必须是 64 位十六进制字符串')
    }
    return Buffer.from(keyString, 'hex')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 ENCRYPTION_KEY')
  }

  if (!developmentKey) {
    developmentKey = crypto.randomBytes(KEY_LENGTH)
    console.warn('⚠️ 未配置 ENCRYPTION_KEY：本次开发进程使用临时密钥，重启后无法解密')
  }
  return developmentKey
}

function encryptPayload(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${SECRET_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptPayload(encryptedText: string): string {
  if (encryptedText.startsWith(SECRET_PREFIX)) {
    const parts = encryptedText.slice(SECRET_PREFIX.length).split(':')
    if (parts.length !== 3) throw new Error('加密数据格式错误')
    const [ivHex, tagHex, encryptedHex] = parts
    if (ivHex.length !== IV_LENGTH * 2 || tagHex.length !== AUTH_TAG_LENGTH * 2) {
      throw new Error('加密数据长度错误')
    }
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivHex, 'hex'),
      { authTagLength: AUTH_TAG_LENGTH }
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]).toString('utf8')
  }

  // 兼容历史 encrypt() 写入的 iv:ciphertext 格式。
  const parts = encryptedText.split(':')
  if (parts.length !== 2 || parts[0].length !== LEGACY_IV_LENGTH * 2) {
    throw new Error('加密数据格式错误')
  }
  const decipher = crypto.createDecipheriv(
    LEGACY_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(parts[0], 'hex')
  )
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function isEncryptedSecret(value?: string | null): boolean {
  return Boolean(value?.startsWith(SECRET_PREFIX))
}

/** 明文写入前加密；已使用当前格式加密的值不会被重复加密。 */
export function protectSecret(value?: string | null): string | null {
  if (!value) return null
  return isEncryptedSecret(value) ? value : encrypt(value)
}

/** 读取应用密文；为迁移兼容，未带当前前缀的数据按历史明文返回。 */
export function revealSecret(value?: string | null): string {
  if (!value) return ''
  return isEncryptedSecret(value) ? decrypt(value) : value
}

/**
 * 加密敏感数据
 * @param data 要加密的数据对象
 * @returns 加密后的字符串
 */
export function encryptCredentials(data: any): string {
  try {
    return encryptPayload(JSON.stringify(data))
  } catch (error) {
    console.error('❌ 加密失败:', error)
    throw new Error('数据加密失败')
  }
}

/**
 * 解密敏感数据
 * @param encryptedData 加密的字符串
 * @returns 解密后的数据对象
 */
export function decryptCredentials(encryptedData: string): any {
  try {
    // 检查数据格式
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('无效的加密数据格式')
    }

    if (encryptedData.startsWith(SECRET_PREFIX) || encryptedData.includes(':')) {
      return JSON.parse(decryptPayload(encryptedData))
    }

    // 兼容历史 encryptCredentials() 的 iv+ciphertext（无分隔符）格式。
    if (encryptedData.length < LEGACY_IV_LENGTH * 2) throw new Error('加密数据长度不足')
    const iv = Buffer.from(encryptedData.slice(0, LEGACY_IV_LENGTH * 2), 'hex')
    const encrypted = encryptedData.slice(LEGACY_IV_LENGTH * 2)
    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, getEncryptionKey(), iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('❌ 解密失败:', error)

    // 如果是解密错误，可能是密钥不匹配
    const err = error as any
    if (err.code === 'ERR_OSSL_BAD_DECRYPT') {
      console.error('💡 可能原因: 加密密钥不匹配，请检查 ENCRYPTION_KEY 环境变量')
    }

    throw new Error('数据解密失败')
  }
}

/**
 * 验证加密数据的完整性
 * @param encryptedData 加密的字符串
 * @returns 是否有效
 */
export function validateEncryptedData(encryptedData: string): boolean {
  try {
    decryptCredentials(encryptedData)
    return true
  } catch {
    return false
  }
}

/**
 * 生成新的加密密钥
 * @returns 十六进制格式的密钥
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * 加密字符串
 * @param text 要加密的字符串
 * @returns 加密后的字符串
 */
export function encrypt(text: string): string {
  try {
    return encryptPayload(text)
  } catch (error) {
    console.error('❌ 字符串加密失败:', error)
    throw new Error('加密失败')
  }
}

/**
 * 解密字符串
 * @param encryptedText 加密的字符串
 * @returns 解密后的字符串
 */
export function decrypt(encryptedText: string): string {
  try {
    // 检查数据格式
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('无效的加密数据格式')
    }

    return decryptPayload(encryptedText)
  } catch (error) {
    console.error('❌ 字符串解密失败:', error)
    const err = error as any
    if (err.code === 'ERR_OSSL_BAD_DECRYPT') {
      console.error('💡 可能原因: 加密密钥不匹配，请检查 ENCRYPTION_KEY 环境变量')
    }
    throw new Error('解密失败')
  }
}

// 认证信息类型定义
export interface GitCredentialData {
  // GitHub Personal Access Token
  token?: string
  
  // SSH 密钥
  privateKey?: string
  publicKey?: string
  passphrase?: string
  
  // 用户名密码
  username?: string
  password?: string
  
  // 其他配置
  email?: string
  gitConfig?: Record<string, string>
}

/**
 * 创建GitHub PAT认证数据
 */
export function createGitHubTokenCredentials(token: string, username?: string): GitCredentialData {
  return {
    token,
    username: username || 'token'
  }
}

/**
 * 创建SSH密钥认证数据
 */
export function createSSHCredentials(
  privateKey: string, 
  publicKey: string, 
  passphrase?: string
): GitCredentialData {
  return {
    privateKey,
    publicKey,
    passphrase
  }
}

/**
 * 创建用户名密码认证数据
 */
export function createUsernamePasswordCredentials(
  username: string, 
  password: string, 
  email?: string
): GitCredentialData {
  return {
    username,
    password,
    email
  }
}
