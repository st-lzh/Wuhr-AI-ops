import { simpleGit, SimpleGit, GitError } from 'simple-git'
import { GitCredentialData } from '../crypto/encryption'
import { GitRepositoryInfo, GitValidationOptions } from '../../app/types/access-management'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { checkLocalDiskSpace, cleanupTempFiles, createSafeWorkDir } from '../utils/diskSpaceUtils'

/**
 * Git操作类
 */
export class GitOperations {
  private git: SimpleGit
  private tempDir: string

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'wuhr-git-ops')
    this.git = simpleGit()
  }

  /**
   * 验证Git仓库访问权限
   */
  async validateRepository(url: string, options?: GitValidationOptions): Promise<GitRepositoryInfo> {
    try {
      console.log('🔍 开始验证Git仓库:', { url, platform: options?.platform, authType: options?.authType })

      // 构建认证URL
      const authUrl = this.buildAuthenticatedUrl(url, options?.credentials, options?.authType)
      
      // 检查仓库可访问性
      const isAccessible = await this.checkRepositoryAccess(authUrl)
      if (!isAccessible) {
        return {
          url,
          type: 'git',
          accessible: false,
          error: '无法访问仓库，请检查URL和认证信息'
        }
      }

      // 获取分支信息
      const branches = await this.getBranches(authUrl)
      const defaultBranch = this.getDefaultBranch(branches)

      // 检测项目类型（需要克隆部分内容）
      const projectInfo = await this.detectProjectType(authUrl)

      console.log('✅ 仓库验证成功:', { 
        accessible: true, 
        branches: branches.length,
        defaultBranch,
        projectType: projectInfo.projectType
      })

      return {
        url,
        type: 'git',
        accessible: true,
        branches,
        defaultBranch,
        projectType: projectInfo.projectType,
        packageManager: projectInfo.packageManager,
        hasDockerfile: projectInfo.hasDockerfile,
        hasCI: projectInfo.hasCI
      }

    } catch (error) {
      console.error('❌ Git仓库验证失败:', error)
      
      let errorMessage = '仓库验证失败'
      if (error instanceof GitError) {
        if (error.message.includes('Authentication failed')) {
          errorMessage = '认证失败，请检查访问令牌或SSH密钥'
        } else if (error.message.includes('Repository not found')) {
          errorMessage = '仓库不存在或无访问权限'
        } else if (error.message.includes('Network')) {
          errorMessage = '网络连接失败，请检查网络设置'
        }
      }

      return {
        url,
        type: 'git',
        accessible: false,
        error: errorMessage
      }
    }
  }

  /**
   * 构建带认证信息的URL
   */
  private buildAuthenticatedUrl(url: string, credentials?: GitCredentialData, authType?: string): string {
    if (!credentials || !authType) {
      return url
    }

    try {
      const urlObj = new URL(url)
      
      switch (authType) {
        case 'token':
          if (credentials.token) {
            // 不同平台的Token认证格式
            if (urlObj.hostname.includes('github.com')) {
              // GitHub PAT格式: https://token@github.com/user/repo.git
              urlObj.username = credentials.token
              urlObj.password = ''
              console.log('🔐 构建GitHub Token认证URL')
            } else if (urlObj.hostname.includes('gitlab')) {
              // GitLab Token格式: https://oauth2:token@gitlab.com/user/repo.git
              urlObj.username = 'oauth2'
              urlObj.password = credentials.token
              console.log('🔐 构建GitLab Token认证URL')
            } else {
              // 通用Token格式
              urlObj.username = credentials.token
              urlObj.password = ''
              console.log('🔐 构建通用Token认证URL')
            }
          }
          break
          
        case 'username_password':
          if (credentials.username && credentials.password) {
            // 对于GitHub等平台，需要URL编码用户名和密码
            urlObj.username = encodeURIComponent(credentials.username)
            urlObj.password = encodeURIComponent(credentials.password)
            console.log('🔐 构建用户名密码认证URL:', {
              username: credentials.username,
              hasPassword: !!credentials.password,
              platform: urlObj.hostname
            })
          }
          break
          
        case 'ssh':
          // SSH URL不需要修改，会使用SSH密钥
          return url
          
        default:
          return url
      }
      
      return urlObj.toString()
    } catch {
      return url
    }
  }

  /**
   * 检查仓库访问权限
   */
  private async checkRepositoryAccess(url: string): Promise<boolean> {
    try {
      console.log('🔍 检查仓库访问权限:', url)

      // 使用 git ls-remote 检查仓库访问权限
      const result = await this.git.listRemote([url])

      console.log('📊 ls-remote结果长度:', result.length)
      if (result.length > 0) {
        console.log('✅ 仓库访问成功')
        return true
      } else {
        console.log('❌ 仓库访问失败：无返回结果')
        return false
      }
    } catch (error) {
      console.error('❌ 仓库访问检查失败:', error)

      // 分析错误类型
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()
        if (errorMessage.includes('authentication failed') || errorMessage.includes('invalid username or password')) {
          console.log('🔐 认证失败：用户名或密码错误')
        } else if (errorMessage.includes('repository not found')) {
          console.log('📂 仓库不存在或无访问权限')
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          console.log('🌐 网络连接问题')
        }
      }

      return false
    }
  }

  /**
   * 获取仓库分支列表
   */
  private async getBranches(url: string): Promise<string[]> {
    try {
      const result = await this.git.listRemote([url])
      const branches: string[] = []
      
      // 解析远程分支信息
      const lines = result.split('\n')
      for (const line of lines) {
        const match = line.match(/refs\/heads\/(.+)$/)
        if (match) {
          branches.push(match[1])
        }
      }
      
      return branches.length > 0 ? branches : ['main', 'master']
    } catch {
      return ['main', 'master']
    }
  }

  /**
   * 获取默认分支
   */
  private getDefaultBranch(branches: string[]): string {
    // 优先级: main > master > develop > dev > 第一个分支
    const priorities = ['main', 'master', 'develop', 'dev']
    
    for (const priority of priorities) {
      if (branches.includes(priority)) {
        return priority
      }
    }
    
    return branches[0] || 'main'
  }

  /**
   * 检测项目类型
   */
  private async detectProjectType(url: string): Promise<{
    projectType?: string
    packageManager?: string
    hasDockerfile?: boolean
    hasCI?: boolean
  }> {
    let tempRepoDir = ''
    try {
      // 检查磁盘空间并创建安全的临时目录
      const dirName = `repo-${Date.now()}`
      const workDirResult = await createSafeWorkDir(this.tempDir, dirName, 0.5) // 需要500MB空间
      
      if (!workDirResult.success) {
        console.error('创建项目检测临时目录失败:', workDirResult.error)
        throw new Error(workDirResult.error || '磁盘空间不足，无法创建临时目录')
      }
      
      tempRepoDir = workDirResult.workDir!

      // 浅克隆仓库（只获取最新提交）
      await this.git.clone(url, tempRepoDir, ['--depth', '1'])
      
      // 检测项目文件
      const files = await fs.readdir(tempRepoDir)
      
      let projectType: string | undefined
      let packageManager: string | undefined
      let hasDockerfile = false
      let hasCI = false

      // 检测项目类型和包管理器
      if (files.includes('package.json')) {
        const packageJson = JSON.parse(
          await fs.readFile(path.join(tempRepoDir, 'package.json'), 'utf-8')
        )
        
        // 检测前端框架
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
        if (dependencies.react) {
          projectType = dependencies.next ? 'nextjs-app' : 'react-app'
        } else if (dependencies.vue) {
          projectType = 'vue-app'
        } else if (dependencies.express) {
          projectType = 'nodejs-api'
        }
        
        // 检测包管理器
        if (files.includes('yarn.lock')) {
          packageManager = 'yarn'
        } else if (files.includes('pnpm-lock.yaml')) {
          packageManager = 'pnpm'
        } else {
          packageManager = 'npm'
        }
      } else if (files.includes('pom.xml')) {
        projectType = 'spring-boot'
        packageManager = 'maven'
      } else if (files.includes('build.gradle')) {
        projectType = 'spring-boot'
        packageManager = 'gradle'
      } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
        projectType = 'python-flask'
        packageManager = 'pip'
      }

      // 检测Docker
      hasDockerfile = files.includes('Dockerfile')

      // 检测CI/CD配置
      hasCI = files.some(file => 
        file.startsWith('.github') || 
        file.startsWith('.gitlab-ci') || 
        file === 'Jenkinsfile' ||
        file === '.travis.yml'
      )

      // 清理临时目录
      if (tempRepoDir) {
        await fs.rm(tempRepoDir, { recursive: true, force: true })
      }

      return {
        projectType,
        packageManager,
        hasDockerfile,
        hasCI
      }
    } catch (error) {
      console.error('项目类型检测失败:', error)
      // 确保清理临时目录
      if (tempRepoDir) {
        try {
          await fs.rm(tempRepoDir, { recursive: true, force: true })
        } catch (cleanupError) {
          console.warn('清理临时目录失败:', cleanupError)
        }
      }
      
      // 如果是磁盘空间问题，返回更详细的错误信息
      if (error instanceof Error && error.message.includes('磁盘空间')) {
        throw error // 重新抛出磁盘空间错误
      }
      
      return {}
    }
  }

  /**
   * 清理临时文件
   */
  async cleanup(): Promise<void> {
    try {
      // 先尝试使用智能清理，清理过期文件
      const cleanupResult = await cleanupTempFiles(this.tempDir, 1) // 清理1小时前的文件
      console.log(`Git操作临时文件清理完成: 删除${cleanupResult.deletedFiles.length}个文件，释放${cleanupResult.freedSpaceGB.toFixed(2)}GB空间`)
      
      // 如果需要，完全删除临时目录
      await fs.rm(this.tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Git临时文件清理失败:', error)
    }
  }
}
