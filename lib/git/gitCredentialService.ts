import { getPrismaClient } from '../config/database'
import { GitCredentialData, GitAuthType } from '../../app/types/access-management'
import { decryptCredentials } from '../crypto/encryption'
import { GitOperations } from './gitOperations'

// 保持向后兼容的类型别名
export interface GitCredentials extends GitCredentialData {
  type: GitAuthType
}

/**
 * Git认证服务
 */
export class GitCredentialService {
  
  /**
   * 获取项目的Git认证信息
   */
  static async getProjectCredentials(projectId: string): Promise<GitCredentials | null> {
    const prisma = await getPrismaClient()

    try {
      // 获取项目信息，包括用户ID
      const project = await prisma.cICDProject.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          gitCredentialId: true,
          repositoryUrl: true
        }
      })

      if (!project) {
        return null
      }

      // 单团队共享凭据；项目显式选择优先，否则匹配团队默认或平台凭据。
      const gitCredential = project.gitCredentialId
        ? await prisma.gitCredential.findFirst({
            where: { id: project.gitCredentialId, isActive: true }
          })
        : await prisma.gitCredential.findFirst({
            where: {
              isActive: true,
              OR: [
                { platform: this.detectPlatform(project.repositoryUrl || '') },
                { isDefault: true }
              ]
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
          })

      if (gitCredential) {
        try {
          // 解密认证信息
          const decryptedCredentials = decryptCredentials(gitCredential.encryptedCredentials)

          // 根据认证类型优化返回的认证信息
          const credentials: GitCredentials = {
            type: gitCredential.authType as GitAuthType
          }

          // Token认证：只需要token，不需要用户名密码
          if (gitCredential.authType === 'token' && decryptedCredentials.token) {
            credentials.token = decryptedCredentials.token
            console.log('🔐 使用Token认证')
          }
          // 用户名密码认证
          else if (gitCredential.authType === 'username_password' && decryptedCredentials.username && decryptedCredentials.password) {
            credentials.username = decryptedCredentials.username
            credentials.password = decryptedCredentials.password
            console.log('🔐 使用用户名密码认证')
          }
          // SSH密钥认证
          else if (gitCredential.authType === 'ssh' && decryptedCredentials.privateKey) {
            credentials.privateKey = decryptedCredentials.privateKey
            credentials.username = decryptedCredentials.username || 'git'
            console.log('🔐 使用SSH密钥认证')
          }
          else {
            console.log(`⚠️ 认证配置不完整 (${gitCredential.authType})`)
            return null
          }

          return credentials
        } catch (error) {
          console.error(`❌ 解密Git认证信息失败 (ID: ${gitCredential.id}):`, error instanceof Error ? error.message : String(error))
          console.log('💡 建议：重新配置Git认证信息')
          return null
        }
      }

      return null

    } catch (error) {
      console.error('获取Git认证信息失败:', error)
      return null
    }
  }
  
  /**
   * 检测Git平台类型
   */
  private static detectPlatform(repositoryUrl: string): string {
    if (!repositoryUrl) return 'unknown'

    if (repositoryUrl.includes('github.com')) return 'github'
    if (repositoryUrl.includes('gitlab.com') || repositoryUrl.includes('gitlab')) return 'gitlab'
    if (repositoryUrl.includes('bitbucket.org')) return 'bitbucket'
    if (repositoryUrl.includes('git.ope.ai')) return 'custom'

    return 'unknown'
  }

  /**
   * 验证Git认证信息
   */
  static async validateCredentials(
    repositoryUrl: string, 
    credentials: GitCredentials
  ): Promise<boolean> {
    const gitOps = new GitOperations()
    try {
      const result = await gitOps.validateRepository(repositoryUrl, {
        credentials,
        platform: this.detectPlatform(repositoryUrl) as any,
        authType: credentials.type
      })
      return result.accessible
    } catch (error) {
      console.error('Git认证验证失败:', error)
      return false
    } finally {
      await gitOps.cleanup()
    }
  }
  
  /**
   * 构建带认证信息的Git URL
   */
  static buildAuthenticatedGitUrl(repositoryUrl: string, credentials: GitCredentials): string {
    if (!credentials) {
      return repositoryUrl
    }

    try {
      const url = new URL(repositoryUrl)
      
      switch (credentials.type) {
        case 'username_password':
          if (credentials.username && credentials.password) {
            url.username = encodeURIComponent(credentials.username)
            url.password = encodeURIComponent(credentials.password)
          }
          break
          
        case 'token':
          if (credentials.token) {
            // GitHub Personal Access Token
            if (url.hostname === 'github.com') {
              url.username = credentials.token
              url.password = 'x-oauth-basic'
            } else if (url.hostname === 'gitlab.com') {
              url.username = 'oauth2'
              url.password = credentials.token
            } else {
              // 其他平台，尝试使用token作为用户名
              url.username = credentials.token
            }
          }
          break
          
        case 'ssh':
          // SSH URL不需要在这里处理认证，由SSH配置处理
          return repositoryUrl
      }
      
      return url.toString()
    } catch (error) {
      console.warn(`Git URL构建失败，使用原始URL: ${error instanceof Error ? error.message : '未知错误'}`)
      return repositoryUrl
    }
  }
  
  /**
   * 为SSH认证创建临时密钥文件
   */
  static async createTempSSHKey(credentials: GitCredentials): Promise<string | null> {
    if (credentials.type !== 'ssh' || !credentials.privateKey) {
      return null
    }
    
    try {
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      
      // 创建临时密钥文件
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ssh-'))
      const keyPath = path.join(tempDir, 'id_rsa')
      
      fs.writeFileSync(keyPath, credentials.privateKey, { mode: 0o600 })
      
      return keyPath
    } catch (error) {
      console.error('创建临时SSH密钥失败:', error)
      return null
    }
  }
  
  /**
   * 清理临时SSH密钥文件
   */
  static async cleanupTempSSHKey(keyPath: string): Promise<void> {
    try {
      const fs = require('fs')
      const path = require('path')
      
      if (fs.existsSync(keyPath)) {
        // 删除密钥文件
        fs.unlinkSync(keyPath)
        
        // 删除临时目录
        const tempDir = path.dirname(keyPath)
        fs.rmdirSync(tempDir)
      }
    } catch (error) {
      console.warn('清理临时SSH密钥失败:', error)
    }
  }
}
