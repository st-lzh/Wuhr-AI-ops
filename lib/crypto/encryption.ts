import crypto from 'crypto'

// 加密配置
const ALGORITHM = 'aes-256-cbc'
const KEY_LENGTH = 32
const IV_LENGTH = 16

// 从环境变量获取加密密钥，如果不存在则生成一个
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY
  if (keyString) {
    return Buffer.from(keyString, 'hex')
  }
  
  // 如果没有设置加密密钥，生成一个新的（仅用于开发环境）
  console.warn('⚠️  ENCRYPTION_KEY not set, generating a new one for development')
  const newKey = crypto.randomBytes(KEY_LENGTH)
  console.log('🔑 Generated encryption key (add to .env):', newKey.toString('hex'))
  return newKey
}

/**
 * 加密敏感数据
 * @param data 要加密的数据对象
 * @returns 加密后的字符串
 */
export function encryptCredentials(data: any): string {
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const plaintext = JSON.stringify(data)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 组合 IV + 加密数据
    const result = iv.toString('hex') + encrypted
    return result
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

    // 检查数据长度
    if (encryptedData.length < IV_LENGTH * 2) {
      throw new Error('加密数据长度不足')
    }

    const key = getEncryptionKey()

    // 提取 IV 和加密数据
    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex')
    const encrypted = encryptedData.slice(IV_LENGTH * 2)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

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
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 将IV和加密数据组合
    return iv.toString('hex') + ':' + encrypted
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

    const parts = encryptedText.split(':')
    if (parts.length !== 2) {
      throw new Error('加密数据格式错误')
    }

    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
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
