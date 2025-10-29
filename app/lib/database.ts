import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// 加密密钥
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'wuhr-ai-config-key-32-chars-long'
const ALGORITHM = 'aes-256-cbc'

// 确保密钥长度为32字节（AES-256要求）
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)
  return Buffer.from(key, 'utf8')
}

// 加密函数
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = getKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

// 解密函数
function decrypt(text: string): string {
  try {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = textParts.join(':')
    const key = getKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('解密失败:', error)
    return ''
  }
}

// 配置文件路径
const CONFIG_DIR = path.join(process.cwd(), 'data')
const JENKINS_CONFIG_FILE = path.join(CONFIG_DIR, 'jenkins-config.json')
const GRAFANA_CONFIG_FILE = path.join(CONFIG_DIR, 'grafana-config.json')

// 确保配置目录存在
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR)
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  }
}

// 简化的数据库接口
export const getDatabase = () => ({
  // Jenkins配置操作
  async get(query: string): Promise<any> {
    await ensureConfigDir()

    if (query.includes('jenkins_config')) {
      try {
        const data = await fs.readFile(JENKINS_CONFIG_FILE, 'utf8')
        const config = JSON.parse(data)

        // 解密敏感信息
        if (config.password) {
          config.password = decrypt(config.password)
        }
        if (config.apiToken) {
          config.apiToken = decrypt(config.apiToken)
        }

        return config
      } catch {
        return null
      }
    }

    if (query.includes('grafana_config')) {
      try {
        const data = await fs.readFile(GRAFANA_CONFIG_FILE, 'utf8')
        const config = JSON.parse(data)

        // 解密敏感信息
        if (config.password) {
          config.password = decrypt(config.password)
        }
        if (config.apiKey) {
          config.apiKey = decrypt(config.apiKey)
        }

        return config
      } catch {
        return null
      }
    }

    return null
  },

  async run(query: string, params: any[] = []): Promise<void> {
    await ensureConfigDir()

    if (query.includes('jenkins_config')) {
      const [serverUrl, username, password, apiToken, port, enabled] = params

      const config = {
        id: 1,
        serverUrl,
        username,
        password: password ? encrypt(password) : null,
        apiToken: apiToken ? encrypt(apiToken) : null,
        port: port || 8080,
        enabled: enabled ? 1 : 0,
        updatedAt: new Date().toISOString()
      }

      await fs.writeFile(JENKINS_CONFIG_FILE, JSON.stringify(config, null, 2))
    }

    if (query.includes('grafana_config')) {
      const [serverUrl, username, password, apiKey, orgId, enabled] = params

      const config = {
        id: 1,
        serverUrl,
        username,
        password: password ? encrypt(password) : null,
        apiKey: apiKey ? encrypt(apiKey) : null,
        orgId: orgId || 1,
        enabled: enabled ? 1 : 0,
        updatedAt: new Date().toISOString()
      }

      await fs.writeFile(GRAFANA_CONFIG_FILE, JSON.stringify(config, null, 2))
    }
  }
})

export async function closeDatabase() {
  // JSON文件存储不需要关闭连接
}
