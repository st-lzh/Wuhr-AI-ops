import { spawn } from 'child_process'
import { getPrismaClient } from '../config/database'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { GitCredentialService } from '../git/gitCredentialService'

export interface DeploymentConfig {
  deploymentId: string
  hostId?: string // 单个主机ID（向后兼容）
  deploymentHosts?: string[] // 多个主机ID列表
  buildScript?: string
  deployScript?: string
  workingDirectory?: string
  environment?: Record<string, string>
  timeout?: number
  stopOnFirstFailure?: boolean // 是否在第一个主机失败时停止
  // Git配置
  repositoryUrl?: string
  branch?: string
  gitCredentials?: {
    type: 'username_password' | 'token' | 'ssh'
    username?: string
    password?: string
    token?: string
    privateKey?: string
  }
  // 远程部署配置
  remoteProjectPath?: string  // 远程主机上的项目路径
  useRemoteProject?: boolean  // 是否直接在远程主机的项目目录执行部署
}

export interface DeploymentResult {
  success: boolean
  logs: string
  duration: number
  error?: string
}

export class DeploymentExecutor {
  private deploymentId: string
  private logs: string[] = []
  private hostInfo: any = null
  private workingDir: string
  private codeDir: string

  constructor(deploymentId: string, repositoryUrl?: string) {
    this.deploymentId = deploymentId
    this.workingDir = path.join(process.cwd(), 'deployments', deploymentId)

    // 根据仓库URL生成代码目录名称
    if (repositoryUrl) {
      const repoName = this.extractRepoName(repositoryUrl)
      // 代码目录结构: deployments/projects/{项目名}/
      this.codeDir = path.join(process.cwd(), 'deployments', 'projects', repoName)
    } else {
      this.codeDir = path.join(process.cwd(), 'deployments', 'projects', 'default')
    }
  }

  /**
   * 从仓库URL中提取仓库名称
   */
  private extractRepoName(repositoryUrl: string): string {
    try {
      // 移除.git后缀并提取最后一部分
      const cleanUrl = repositoryUrl.replace(/\.git$/, '')
      const parts = cleanUrl.split('/')
      const repoName = parts[parts.length - 1]

      // 确保名称是有效的目录名
      return repoName.replace(/[^a-zA-Z0-9\-_]/g, '_') || 'unknown'
    } catch (error) {
      return 'unknown'
    }
  }

  /**
   * 执行完整的部署任务
   */
  async execute(config: DeploymentConfig): Promise<DeploymentResult> {
    const startTime = Date.now()

    try {
      this.log('🚀 开始完整部署流程...')

      // 阶段1: 准备工作目录
      await this.prepareWorkingDirectory()

      // 阶段2: 代码拉取
      if (config.repositoryUrl) {
        try {
          await this.pullCode(config)
        } catch (error) {
          this.log(`❌ 代码拉取失败: ${error instanceof Error ? error.message : '未知错误'}`)
          this.log('⚠️ 跳过代码拉取，继续执行后续阶段...')

          // 创建一个空的代码目录以便后续阶段可以继续
          if (!fs.existsSync(this.codeDir)) {
            fs.mkdirSync(this.codeDir, { recursive: true })
            this.log('📁 创建空代码目录以继续部署流程')
          }
        }
      } else {
        this.log('⚠️ 未配置Git仓库，跳过代码拉取阶段')
      }

      // 阶段3: 本地构建
      if (config.buildScript) {
        await this.buildLocally(config)
      } else {
        this.log('⚠️ 未配置构建脚本，跳过构建阶段')
      }

      // 阶段4: 远程部署
      this.log('📋 检查部署配置...')
      this.log(`🔧 部署脚本: ${config.deployScript ? '已配置' : '未配置'}`)

      // 支持多主机部署
      const hostIds = config.deploymentHosts || (config.hostId ? [config.hostId] : [])
      this.log(`🎯 目标主机数量: ${hostIds.length}`)

      if (hostIds.length === 0) {
        this.log('⚠️ 未配置部署主机，跳过部署阶段')
        this.log('💡 提示：请选择至少一个部署主机')
      } else if (config.deployScript) {
        this.log('🚀 开始多主机部署阶段...')
        await this.deployToMultipleHosts(config, hostIds)
        this.log('✅ 多主机部署阶段完成')
      } else {
        this.log('⚠️ 未配置部署脚本，跳过部署阶段')
        this.log('💡 提示：请在项目配置中添加部署脚本以启用自动部署')
      }

      // 阶段5: 验证部署
      await this.verifyDeployment()

      // 阶段6: 清理工作目录
      await this.cleanup()

      const duration = Date.now() - startTime
      this.log(`🎉 完整部署流程成功完成，总耗时: ${Math.round(duration / 1000)}秒`)

      return {
        success: true,
        logs: this.logs.join('\n'),
        duration: Math.round(duration / 1000)
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 部署流程失败: ${errorMessage}`)

      // 清理工作目录
      await this.cleanup()

      return {
        success: false,
        logs: this.logs.join('\n'),
        duration: Math.round(duration / 1000),
        error: errorMessage
      }
    }
  }

  /**
   * 准备工作目录
   */
  private async prepareWorkingDirectory(): Promise<void> {
    this.log('📁 准备工作目录...')

    try {
      // 如果工作目录已存在，先清理旧的代码目录
      if (fs.existsSync(this.workingDir)) {
        this.log('🧹 发现已存在的工作目录，清理旧代码...')
        if (fs.existsSync(this.codeDir)) {
          await this.safeRemoveDirectory(this.codeDir)
          this.log('✅ 旧代码目录清理完成')
        }
      }

      // 创建工作目录
      if (!fs.existsSync(this.workingDir)) {
        fs.mkdirSync(this.workingDir, { recursive: true })
        this.log(`📂 创建工作目录: ${this.workingDir}`)
      }

      // 创建全新的代码目录
      if (!fs.existsSync(this.codeDir)) {
        fs.mkdirSync(this.codeDir, { recursive: true })
        this.log(`📂 创建代码目录: ${this.codeDir}`)
      }

      // 创建日志目录
      const logDir = path.join(this.workingDir, 'logs')
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
        this.log(`📂 创建日志目录: ${logDir}`)
      }

      this.log(`✅ 工作目录准备完成: ${this.workingDir}`)
      this.log(`   - 代码目录: ${this.codeDir}`)
      this.log(`   - 日志目录: ${logDir}`)
    } catch (error) {
      throw new Error(`工作目录准备失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 从Git仓库拉取代码（全新克隆）
   */
  private async pullCode(config: DeploymentConfig): Promise<void> {
    this.log('📥 开始拉取代码...')

    if (!config.repositoryUrl) {
      throw new Error('未配置Git仓库URL')
    }

    try {
      const branch = config.branch || 'main'
      const repoName = this.extractRepoName(config.repositoryUrl)

      this.log(`🔗 仓库地址: ${config.repositoryUrl}`)
      this.log(`📦 项目名称: ${repoName}`)
      this.log(`🌿 目标分支: ${branch}`)
      this.log(`📁 项目代码目录: ${this.codeDir}`)

      // 构建Git命令
      const gitUrl = this.buildGitUrl(config.repositoryUrl, config.gitCredentials)

      // 执行全新克隆
      this.log('📦 执行全新代码克隆...')

      // 先检查目标目录状态
      if (fs.existsSync(this.codeDir)) {
        this.log(`⚠️ 发现目标目录已存在: ${this.codeDir}`)
        const dirContents = fs.readdirSync(this.codeDir)
        this.log(`📁 目录内容: ${dirContents.length > 0 ? dirContents.join(', ') : '空目录'}`)

        // 强制清理目录
        this.log('🧹 强制清理目标目录...')
        await this.forceRemoveDirectory(this.codeDir)
        this.log('✅ 目录清理完成')
      }

      try {
        await this.cloneRepository(gitUrl, branch)
      } catch (cloneError) {
        this.log('❌ 认证克隆失败，分析错误原因...')
        this.log(`🔍 克隆错误详情: ${cloneError instanceof Error ? cloneError.message : '未知错误'}`)

        // 检查是否是认证问题
        const errorMsg = cloneError instanceof Error ? cloneError.message : ''
        if (errorMsg.includes('Authentication failed') ||
            errorMsg.includes('Permission denied') ||
            errorMsg.includes('access denied') ||
            errorMsg.includes('401') ||
            errorMsg.includes('403')) {
          this.log('🔐 检测到认证问题，尝试无认证访问...')

          // 再次强制清理目录
          await this.forceRemoveDirectory(this.codeDir)
          this.log('🧹 重新清理目录完成，准备无认证克隆...')

          // 使用原始仓库URL（无认证信息）
          await this.cloneRepository(config.repositoryUrl!, branch)
        } else if (errorMsg.includes('already exists and is not an empty directory')) {
          this.log('📁 目录冲突问题，执行深度清理...')

          // 执行更彻底的清理
          await this.deepCleanDirectory(this.codeDir)
          this.log('🧹 深度清理完成，重新尝试克隆...')

          // 重新尝试认证克隆
          await this.cloneRepository(gitUrl, branch)
        } else {
          // 其他错误，直接抛出
          throw cloneError
        }
      }

      this.log('✅ 代码拉取完成')

      // 显示最新提交信息
      const commitInfo = await this.executeCommand('git', ['log', '-1', '--oneline'], this.codeDir)
      this.log(`📝 最新提交: ${commitInfo.trim()}`)

    } catch (error) {
      throw new Error(`代码拉取失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 克隆Git仓库
   */
  private async cloneRepository(gitUrl: string, branch: string): Promise<void> {
    this.log(`📥 克隆仓库: ${gitUrl} (分支: ${branch})`)

    // 确保父目录存在
    const parentDir = path.dirname(this.codeDir)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }

    try {
      // 克隆仓库
      await this.executeCommand('git', [
        'clone',
        '--branch', branch,
        '--single-branch',
        gitUrl,
        this.codeDir
      ], parentDir)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      // 检查是否是认证错误
      if (errorMessage.includes('认证失败') || errorMessage.includes('Authentication failed') ||
          errorMessage.includes('access denied') || errorMessage.includes('访问被拒绝')) {
        this.log('🔐 检测到Git认证失败')
        this.log('💡 解决方案:')
        this.log('   1. 运行Git认证配置脚本: ./scripts/setup-git-auth.sh')
        this.log('   2. 检查用户名和密码是否正确')
        this.log('   3. 如果启用了2FA，请使用Personal Access Token')
        this.log('   4. 确认账户有仓库访问权限')

        throw new Error(`Git认证失败: ${errorMessage}`)
      }

      throw error
    }
  }

  /**
   * 本地构建
   */
  private async buildLocally(config: DeploymentConfig): Promise<void> {
    this.log('🔨 开始本地构建...')

    try {
      // 在代码目录中执行构建脚本
      await this.executeCommand('sh', ['-c', config.buildScript!], this.codeDir, config.environment)
      this.log('✅ 本地构建完成')
    } catch (error) {
      throw new Error(`本地构建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 部署到多个主机
   */
  private async deployToMultipleHosts(config: DeploymentConfig, hostIds: string[]): Promise<void> {
    this.log(`🎯 开始部署到 ${hostIds.length} 个主机...`)

    const deploymentResults = []

    for (let i = 0; i < hostIds.length; i++) {
      const hostId = hostIds[i]
      this.log(`\n=== 部署到主机 ${i + 1}/${hostIds.length}: ${hostId} ===`)

      try {
        // 为每个主机创建独立的配置
        const hostConfig = { ...config, hostId }
        await this.deployRemotely(hostConfig)

        deploymentResults.push({
          hostId,
          success: true,
          message: '部署成功'
        })

        this.log(`✅ 主机 ${hostId} 部署成功`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        deploymentResults.push({
          hostId,
          success: false,
          message: errorMessage
        })

        this.log(`❌ 主机 ${hostId} 部署失败: ${errorMessage}`)

        // 根据配置决定是否继续部署其他主机
        if (config.stopOnFirstFailure) {
          this.log('⚠️ 配置为首次失败即停止，终止后续主机部署')
          break
        } else {
          this.log('⚠️ 继续部署其他主机...')
        }
      }
    }

    // 汇总部署结果
    const successCount = deploymentResults.filter(r => r.success).length
    const failureCount = deploymentResults.filter(r => !r.success).length

    this.log(`\n📊 多主机部署结果汇总:`)
    this.log(`   ✅ 成功: ${successCount} 个主机`)
    this.log(`   ❌ 失败: ${failureCount} 个主机`)

    if (failureCount > 0) {
      this.log(`\n❌ 失败的主机:`)
      deploymentResults
        .filter(r => !r.success)
        .forEach(r => this.log(`   - ${r.hostId}: ${r.message}`))

      // 如果有主机部署失败，抛出错误
      throw new Error(`${failureCount} 个主机部署失败`)
    }

    this.log(`🎉 所有主机部署成功完成！`)
  }

  /**
   * 远程部署（单个主机）
   */
  private async deployRemotely(config: DeploymentConfig): Promise<void> {
    this.log('🚀 开始远程部署...')

    try {
      // 获取主机信息
      this.log('📡 获取主机配置信息...')
      this.hostInfo = await this.getHostInfo(config.hostId || '')
      if (!this.hostInfo) {
        throw new Error(`主机配置不存在: ${config.hostId}`)
      }

      this.log(`🎯 目标主机: ${this.hostInfo.name} (${this.hostInfo.host})`)
      this.log(`🔐 认证类型: ${this.hostInfo.authType}`)

      // 根据配置选择部署方式
      if (this.hostInfo.authType !== 'local') {
        if (config.useRemoteProject && config.remoteProjectPath) {
          // 方式1: 直接在远程主机的项目目录执行部署命令
          this.log('🎯 使用远程项目目录部署模式')
          this.log(`📂 远程项目路径: ${config.remoteProjectPath}`)
          await this.deployOnRemoteProject(config)
        } else {
          // 方式2: 传统方式 - 传输构建产物后部署
          this.log('📤 使用传统部署模式 - 传输构建产物...')
          await this.transferBuildArtifacts()
          this.log('✅ 构建产物传输完成')
          await this.executeDeploymentScript(config.deployScript!, config.environment)
        }
      } else {
        this.log('💻 检测到本地主机，直接执行部署脚本')
        await this.executeDeploymentScript(config.deployScript!, config.environment)
      }

      this.log('✅ 远程部署完成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 远程部署失败: ${errorMessage}`)

      // 提供详细的错误诊断和解决建议
      if (errorMessage.includes('Permission denied') || errorMessage.includes('权限被拒绝')) {
        this.log('🔍 SSH认证失败诊断:')
        this.log(`   主机: ${this.hostInfo?.host}:${this.hostInfo?.port}`)
        this.log(`   用户: ${this.hostInfo?.username}`)
        this.log(`   认证方式: ${this.hostInfo?.authType}`)
        this.log('💡 解决方案:')
        this.log('   1. 检查SSH用户名和密码是否正确')
        this.log('   2. 确认目标主机SSH服务正常运行')
        this.log('   3. 验证用户是否有SSH登录权限')
        this.log('   4. 检查SSH密钥配置（如果使用密钥认证）')
        this.log('   5. 确认防火墙和网络连接正常')
      }

      if (errorMessage.includes('255')) {
        this.log('🔍 SSH连接失败诊断:')
        this.log('💡 可能的原因:')
        this.log('   - SSH服务未运行或端口错误')
        this.log('   - 网络连接问题或主机不可达')
        this.log('   - 防火墙阻止连接')
        this.log('   - 主机配置错误')
      }

      // 立即更新部署状态为失败
      await this.updateDeploymentStatusToFailed(errorMessage)

      throw new Error(`远程部署失败: ${errorMessage}`)
    }
  }

  /**
   * 清理工作目录（保留代码缓存）
   */
  private async cleanup(): Promise<void> {
    try {
      this.log('🧹 清理工作目录...')
      if (fs.existsSync(this.workingDir)) {
        await this.executeCommand('rm', ['-rf', this.workingDir], process.cwd())
      }
      this.log('✅ 工作目录清理完成')

      // 显示项目代码保留信息
      if (fs.existsSync(this.codeDir)) {
        const projectName = path.basename(this.codeDir)
        this.log(`💾 项目代码已保留: ${projectName}`)
        this.log(`📂 代码位置: ${this.codeDir}`)
        this.log('🚀 下次部署将使用增量更新，速度更快')
      }
    } catch (error) {
      this.log(`⚠️ 工作目录清理失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 获取主机信息
   */
  private async getHostInfo(hostId: string) {
    const prisma = await getPrismaClient()

    try {
      // 尝试从数据库获取主机信息
      const host = await prisma.server.findUnique({
        where: { id: hostId },
        select: {
          id: true,
          name: true,
          hostname: true,
          ip: true,
          port: true,
          username: true,
          password: true,
          keyPath: true,
          authType: true, // 添加认证类型字段
          os: true,
          status: true
        }
      })

      if (host) {
        console.log('✅ 找到配置的主机:', {
          name: host.name,
          ip: host.ip || host.hostname,
          authType: host.authType
        })

        // 确定实际的认证类型
        let actualAuthType = host.authType
        if (!actualAuthType) {
          // 如果数据库中没有设置authType，根据其他字段推断
          if (host.keyPath) {
            actualAuthType = 'key'
          } else if (host.password) {
            actualAuthType = 'password'
          } else {
            actualAuthType = 'local'
          }
        }

        console.log(`🔐 主机认证类型: ${actualAuthType}`)

        return {
          id: host.id,
          name: host.name,
          host: host.ip || host.hostname,
          port: host.port || 22,
          username: host.username || 'deploy',
          password: host.password,
          keyPath: host.keyPath,
          authType: actualAuthType
        }
      } else {
        console.log('⚠️ 未找到主机配置，使用本地主机:', hostId)
        // 如果没有找到主机配置，使用本地主机
        return {
          id: hostId,
          name: 'localhost',
          host: 'localhost',
          port: 22,
          username: process.env.USER || 'deploy',
          authType: 'local'
        }
      }
    } catch (error) {
      console.error('❌ 获取主机信息失败:', error)
      // 出错时使用本地主机
      return {
        id: hostId,
        name: 'localhost',
        host: 'localhost',
        port: 22,
        username: process.env.USER || 'deploy',
        authType: 'local'
      }
    }
  }

  /**
   * 执行脚本
   */
  private async executeScript(
    script: string,
    environment?: Record<string, string>,
    timeout: number = 300000 // 默认5分钟超时
  ) {
    return new Promise<void>((resolve, reject) => {
      // 准备环境变量
      const env = { ...process.env, ...environment }

      this.log(`🔧 执行脚本: ${script}`)

      let command: string
      let args: string[]

      // 根据主机类型选择执行方式
      if (this.hostInfo && this.hostInfo.authType !== 'local') {
        // 远程主机执行
        const remoteScript = this.buildRemoteScript(script, environment)
        command = 'ssh'
        args = this.buildSSHArgs(remoteScript)
        this.log(`🌐 远程执行: ssh ${args.join(' ')}`)
      } else {
        // 本地执行
        command = 'sh'
        args = ['-c', script]
        this.log(`💻 本地执行: ${script}`)
      }

      // 使用spawn执行脚本
      const child = spawn(command, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      // 监听标准输出
      child.stdout?.on('data', (data) => {
        const output = data.toString()
        stdout += output
        this.log(output.trim())
        this.updateDeploymentLogs(output)
      })

      // 监听错误输出
      child.stderr?.on('data', (data) => {
        const output = data.toString()
        stderr += output
        this.log(`STDERR: ${output.trim()}`)
        this.updateDeploymentLogs(`STDERR: ${output}`)
      })

      // 监听进程结束
      child.on('close', (code) => {
        if (code === 0) {
          this.log(`✅ 脚本执行成功`)
          resolve()
        } else {
          const error = `脚本执行失败 (退出码: ${code}): ${stderr}`
          this.log(`❌ ${error}`)
          reject(new Error(error))
        }
      })

      // 监听错误
      child.on('error', (error) => {
        const errorMsg = `脚本执行异常: ${error.message}`
        this.log(`❌ ${errorMsg}`)
        reject(new Error(errorMsg))
      })

      // 设置超时
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`脚本执行超时 (${timeout}ms)`))
      }, timeout)

      child.on('close', () => {
        clearTimeout(timeoutId)
      })
    })
  }

  /**
   * 构建Git URL（包含认证信息）
   */
  private buildGitUrl(repositoryUrl: string, credentials?: DeploymentConfig['gitCredentials']): string {
    // 如果没有认证信息，直接返回原始URL
    if (!credentials || !credentials.username || !credentials.password) {
      this.log('📂 使用无认证访问')
      return repositoryUrl
    }

    try {
      const url = new URL(repositoryUrl)

      this.log(`🔐 为${url.hostname}构建认证URL`)

      switch (credentials.type) {
        case 'username_password':
          if (credentials.username && credentials.password) {
            // 确保认证信息不是占位符
            if (credentials.username !== 'git' || credentials.password !== 'token') {
              url.username = encodeURIComponent(credentials.username)
              url.password = encodeURIComponent(credentials.password)
              this.log('✅ 已添加用户名密码认证')
            } else {
              this.log('⚠️ 检测到占位符认证信息，使用原始URL')
              return repositoryUrl
            }
          }
          break
        case 'token':
          if (credentials.token) {
            // 根据Git平台设置不同的认证方式
            if (url.hostname.includes('github.com')) {
              url.username = credentials.token
              url.password = 'x-oauth-basic'
            } else if (url.hostname.includes('gitlab')) {
              url.username = 'oauth2'
              url.password = credentials.token
            } else {
              // 其他平台，使用token作为密码
              url.username = 'git'
              url.password = credentials.token
            }
            this.log('✅ 已添加Token认证')
          }
          break
        case 'ssh':
          // SSH URL不需要在这里处理认证，由SSH配置处理
          this.log('🔑 使用SSH认证，保持原始URL')
          return repositoryUrl
      }

      // 构建最终URL，但在日志中隐藏密码
      const finalUrl = url.toString()
      const logUrl = finalUrl.replace(/:([^@]+)@/, ':***@')
      this.log(`🔗 构建的Git URL: ${logUrl}`)

      return finalUrl
    } catch (error) {
      this.log(`⚠️ Git URL构建失败，使用原始URL: ${error instanceof Error ? error.message : '未知错误'}`)
      return repositoryUrl
    }
  }

  /**
   * 执行命令并返回输出
   */
  private async executeCommand(
    command: string,
    args: string[],
    cwd: string,
    environment?: Record<string, string>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...environment }

      // 处理Mac系统的sudo权限问题
      let finalCommand = command
      let finalArgs = [...args]

      if (process.platform === 'darwin' && command === 'sudo') {
        // Mac系统下，如果是sudo命令，添加-n参数尝试免密码执行
        finalArgs.unshift('-n')
      }

      this.log(`🔧 执行命令: ${finalCommand} ${finalArgs.join(' ')} (在 ${cwd})`)

      const child = spawn(finalCommand, finalArgs, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        const output = data.toString()
        stdout += output
        // 将英文提示翻译为中文
        const translatedOutput = this.translateOutput(output.trim())
        this.log(translatedOutput)
        this.updateDeploymentLogs(translatedOutput)
      })

      child.stderr?.on('data', (data) => {
        const output = data.toString()
        stderr += output
        const translatedOutput = this.translateOutput(output.trim())

        // 检查是否是Git的正常输出（进度信息等）
        if (this.isGitNormalOutput(output)) {
          this.log(`Git信息: ${translatedOutput}`)
          this.updateDeploymentLogs(`Git信息: ${translatedOutput}`)
        } else {
          this.log(`错误输出: ${translatedOutput}`)
          this.updateDeploymentLogs(`错误输出: ${translatedOutput}`)
        }
      })

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          // 检查是否是权限问题
          if (stderr.includes('Password:') || stderr.includes('sudo:') || stderr.includes('permission denied')) {
            this.log('🔐 检测到权限问题，建议运行权限设置脚本:')
            this.log('   chmod +x scripts/setup-mac-permissions.sh')
            this.log('   ./scripts/setup-mac-permissions.sh')
          }
          reject(new Error(`命令执行失败 (退出码: ${code}): ${this.translateOutput(stderr)}`))
        }
      })

      child.on('error', (error) => {
        reject(new Error(`命令执行异常: ${error.message}`))
      })
    })
  }

  /**
   * 在远程主机的项目目录直接执行部署
   */
  private async deployOnRemoteProject(config: DeploymentConfig): Promise<void> {
    this.log('🚀 开始在远程项目目录执行部署...')

    try {
      const remoteProjectPath = config.remoteProjectPath!

      // 1. 检查远程项目目录是否存在
      this.log(`📂 检查远程项目目录: ${remoteProjectPath}`)
      try {
        await this.executeRemoteCommand(`test -d "${remoteProjectPath}"`)
        this.log('✅ 远程项目目录存在')
      } catch (error) {
        this.log('❌ 远程项目目录不存在，尝试创建...')
        await this.executeRemoteCommand(`mkdir -p "${remoteProjectPath}"`)
        this.log('✅ 远程项目目录创建成功')
      }

      // 2. 在远程主机更新代码（如果配置了Git仓库）
      if (config.repositoryUrl) {
        await this.updateRemoteProjectCode(config, remoteProjectPath)
      }

      // 3. 在远程主机执行部署脚本
      this.log('🔧 在远程项目目录执行部署脚本...')
      this.log(`📜 部署脚本内容: ${config.deployScript?.substring(0, 100)}${config.deployScript && config.deployScript.length > 100 ? '...' : ''}`)

      await this.executeRemoteDeploymentScript(config.deployScript!, config.environment, remoteProjectPath)

      this.log('✅ 远程项目部署完成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 远程项目部署失败: ${errorMessage}`)
      throw error
    }
  }

  /**
   * 在远程主机更新项目代码
   */
  private async updateRemoteProjectCode(config: DeploymentConfig, remoteProjectPath: string): Promise<void> {
    this.log('📥 在远程主机更新项目代码...')

    const branch = config.branch || 'main'
    const gitUrl = this.buildGitUrl(config.repositoryUrl!, config.gitCredentials)

    try {
      // 检查远程目录是否已经是Git仓库
      const checkGitCmd = `cd "${remoteProjectPath}" && git status --porcelain`

      try {
        await this.executeRemoteCommand(checkGitCmd)
        this.log('📂 发现远程Git仓库，执行增量更新...')

        // 更新远程仓库
        const updateCommands = [
          `cd "${remoteProjectPath}"`,
          `git remote set-url origin "${gitUrl}"`,
          `git fetch origin ${branch}`,
          `git reset --hard origin/${branch}`,
          `git clean -fd`
        ]

        const updateScript = updateCommands.join(' && ')
        await this.executeRemoteCommand(updateScript)

        this.log('✅ 远程代码增量更新成功')
      } catch (gitError) {
        this.log('📦 远程目录不是Git仓库，执行克隆...')

        // 清空目录并克隆
        const cloneCommands = [
          `rm -rf "${remoteProjectPath}"/*`,
          `rm -rf "${remoteProjectPath}"/.*`,
          `cd "${remoteProjectPath}"`,
          `git clone -b ${branch} "${gitUrl}" .`
        ]

        const cloneScript = cloneCommands.join(' && ')
        await this.executeRemoteCommand(cloneScript)

        this.log('✅ 远程代码克隆成功')
      }

      // 显示最新提交信息
      const commitInfoCmd = `cd "${remoteProjectPath}" && git log -1 --oneline`
      const commitInfo = await this.executeRemoteCommand(commitInfoCmd)
      this.log(`📝 远程最新提交: ${commitInfo.trim()}`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 远程代码更新失败: ${errorMessage}`)
      throw new Error(`远程代码更新失败: ${errorMessage}`)
    }
  }

  /**
   * 在远程主机的项目目录执行部署脚本
   */
  private async executeRemoteDeploymentScript(
    script: string,
    environment?: Record<string, string>,
    remoteProjectPath?: string
  ): Promise<void> {
    this.log('🔧 在远程主机执行部署脚本...')

    let remoteScript = ''

    // 如果指定了远程项目路径，先切换到该目录
    if (remoteProjectPath) {
      remoteScript += `cd "${remoteProjectPath}" && `
      this.log(`📂 远程执行目录: ${remoteProjectPath}`)
    }

    // 添加环境变量
    if (environment) {
      this.log('🌍 设置远程环境变量:')
      for (const [key, value] of Object.entries(environment)) {
        remoteScript += `export ${key}="${value}" && `
        this.log(`   ${key}=${value}`)
      }
    }

    // 添加部署脚本
    remoteScript += script

    this.log('📡 准备执行的完整远程脚本:')
    this.log(`   ${remoteScript}`)
    this.log('🚀 开始在远程主机执行部署脚本...')

    try {
      const result = await this.executeRemoteCommand(remoteScript)
      this.log('📋 远程脚本执行结果:')
      if (result && result.trim()) {
        this.log(result)
      }
      this.log('✅ 远程部署脚本执行完成')
    } catch (error) {
      this.log(`❌ 远程部署脚本执行失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  /**
   * 传输构建产物到远程主机
   */
  private async transferBuildArtifacts(): Promise<void> {
    this.log('📤 传输构建产物到远程主机...')

    try {
      const remoteDir = '/tmp/deployment-' + this.deploymentId

      // 创建远程目录
      await this.executeRemoteCommand(`mkdir -p ${remoteDir}`)

      // 使用rsync传输文件
      if (this.hostInfo.password && !this.hostInfo.keyPath) {
        // 使用密码认证的rsync
        this.log('🔐 使用密码认证传输文件')

        const rsyncArgs = [
          '-avz',
          '--delete',
          '-e', `sshpass -p "${this.hostInfo.password}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR${this.hostInfo.port !== 22 ? ` -p ${this.hostInfo.port}` : ''}`,
          this.codeDir + '/',
          `${this.hostInfo.username}@${this.hostInfo.host}:${remoteDir}/`
        ]

        await this.executeCommand('rsync', rsyncArgs, this.workingDir)
      } else {
        // 使用密钥认证的rsync
        this.log('🔑 使用密钥认证传输文件')

        const rsyncArgs = [
          '-avz',
          '--delete',
          '-e', `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR${this.hostInfo.port !== 22 ? ` -p ${this.hostInfo.port}` : ''}${this.hostInfo.keyPath ? ` -i ${this.hostInfo.keyPath}` : ''}`,
          this.codeDir + '/',
          `${this.hostInfo.username}@${this.hostInfo.host}:${remoteDir}/`
        ]

        await this.executeCommand('rsync', rsyncArgs, this.workingDir)
      }
      this.log('✅ 构建产物传输完成')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ SSH传输失败详情: ${errorMessage}`)

      // 提供具体的错误诊断
      if (errorMessage.includes('255')) {
        this.log('💡 SSH连接失败可能的原因:')
        this.log('   - SSH服务未运行或端口不正确')
        this.log('   - 认证信息错误（用户名/密码/密钥）')
        this.log('   - 网络连接问题或防火墙阻止')
        this.log('   - 目标主机不可达')
      }

      if (errorMessage.includes('Permission denied')) {
        this.log('💡 权限被拒绝的解决方案:')
        this.log('   - 检查用户名和密码是否正确')
        this.log('   - 确认SSH密钥配置正确')
        this.log('   - 验证用户是否有SSH登录权限')
      }

      throw new Error(`构建产物传输失败: ${errorMessage}`)
    }
  }

  /**
   * 执行远程命令
   */
  private async executeRemoteCommand(command: string): Promise<string> {
    this.log(`📡 准备执行远程命令: ${this.hostInfo.username}@${this.hostInfo.host}:${this.hostInfo.port}`)
    this.log(`🔐 认证方式: ${this.hostInfo.authType}`)

    try {
      // 检查认证方式并执行相应的SSH命令
      if (this.hostInfo.authType === 'password' && this.hostInfo.password) {
        this.log('🔐 使用密码认证执行远程命令')

        const sshpassArgs = [
          '-p', this.hostInfo.password,
          'ssh',
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          '-o', 'LogLevel=ERROR',
          '-o', 'ConnectTimeout=30'
        ]

        if (this.hostInfo.port && this.hostInfo.port !== 22) {
          sshpassArgs.push('-p', this.hostInfo.port.toString())
        }

        sshpassArgs.push(`${this.hostInfo.username}@${this.hostInfo.host}`)
        sshpassArgs.push(command)

        this.log(`🔧 SSH命令: sshpass [密码隐藏] ssh ${this.hostInfo.username}@${this.hostInfo.host}`)
        const result = await this.executeCommand('sshpass', sshpassArgs, this.workingDir)
        this.log('✅ 密码认证远程命令执行成功')
        return result

      } else if (this.hostInfo.authType === 'key' && this.hostInfo.keyPath) {
        this.log('🔑 使用密钥认证执行远程命令')

        const sshArgs = [
          '-o', 'StrictHostKeyChecking=no',
          '-o', 'UserKnownHostsFile=/dev/null',
          '-o', 'LogLevel=ERROR',
          '-o', 'ConnectTimeout=30'
        ]

        if (this.hostInfo.port && this.hostInfo.port !== 22) {
          sshArgs.push('-p', this.hostInfo.port.toString())
        }

        if (this.hostInfo.keyPath) {
          sshArgs.push('-i', this.hostInfo.keyPath)
          this.log(`🔑 使用密钥文件: ${this.hostInfo.keyPath}`)
        }

        sshArgs.push(`${this.hostInfo.username}@${this.hostInfo.host}`)
        sshArgs.push(command)

        this.log(`🔧 SSH命令: ssh -i ${this.hostInfo.keyPath} ${this.hostInfo.username}@${this.hostInfo.host}`)
        const result = await this.executeCommand('ssh', sshArgs, this.workingDir)
        this.log('✅ 密钥认证远程命令执行成功')
        return result

      } else {
        throw new Error(`不支持的认证方式: ${this.hostInfo.authType}，或缺少必要的认证信息`)
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 远程命令执行失败: ${errorMsg}`)

      // 提供详细的错误诊断
      if (errorMsg.includes('Permission denied') || errorMsg.includes('Authentication failed')) {
        this.log('🔍 SSH认证失败诊断:')
        this.log(`   目标主机: ${this.hostInfo.host}:${this.hostInfo.port}`)
        this.log(`   SSH用户: ${this.hostInfo.username}`)
        this.log(`   认证类型: ${this.hostInfo.authType}`)
        if (this.hostInfo.authType === 'key') {
          this.log(`   密钥文件: ${this.hostInfo.keyPath}`)
        }
        this.log('💡 请检查:')
        this.log('   1. SSH用户名和认证信息是否正确')
        this.log('   2. 目标主机SSH服务是否正常运行')
        this.log('   3. 用户是否有SSH登录权限')
        this.log('   4. 网络连接是否正常')
      } else if (errorMsg.includes('Connection refused') || errorMsg.includes('No route to host')) {
        this.log('🔍 网络连接失败诊断:')
        this.log(`   目标主机: ${this.hostInfo.host}:${this.hostInfo.port}`)
        this.log('💡 请检查:')
        this.log('   1. 主机IP地址和端口是否正确')
        this.log('   2. 目标主机是否在线')
        this.log('   3. 防火墙是否阻止了SSH连接')
        this.log('   4. SSH服务是否在指定端口运行')
      }

      throw error
    }
  }

  /**
   * 执行部署脚本
   */
  private async executeDeploymentScript(script: string, environment?: Record<string, string>): Promise<void> {
    this.log('🔧 准备执行部署脚本...')

    // 详细记录主机信息和执行决策
    this.log(`🎯 主机信息详情:`)
    this.log(`   主机名: ${this.hostInfo.name}`)
    this.log(`   主机地址: ${this.hostInfo.host}`)
    this.log(`   认证类型: ${this.hostInfo.authType}`)
    this.log(`   SSH端口: ${this.hostInfo.port || 22}`)
    this.log(`   SSH用户: ${this.hostInfo.username}`)

    // 强制检查：只有明确标记为local的主机才在本地执行
    const isLocalHost = this.hostInfo.authType === 'local' ||
                       this.hostInfo.host === 'localhost' ||
                       this.hostInfo.host === '127.0.0.1'

    if (isLocalHost) {
      // 本地执行
      this.log('💻 ===== 在本地主机执行部署脚本 =====')
      this.log(`📂 本地执行目录: ${this.codeDir}`)
      this.log(`🖥️ 本地主机名: ${require('os').hostname()}`)

      if (environment) {
        this.log('🌍 设置本地环境变量:')
        for (const [key, value] of Object.entries(environment)) {
          this.log(`   ${key}=${value}`)
        }
      }

      // 添加执行位置确认到脚本中
      const confirmScript = `echo "🎯 执行位置确认: $(hostname) - $(pwd)" && ${script}`
      await this.executeCommand('sh', ['-c', confirmScript], this.codeDir, environment)
      this.log('✅ 本地部署脚本执行完成')
    } else {
      // 远程执行
      this.log('🌐 ===== 在远程主机执行部署脚本 =====')
      this.log(`📡 目标远程主机: ${this.hostInfo.host}:${this.hostInfo.port || 22}`)
      this.log(`👤 SSH用户: ${this.hostInfo.username}`)

      const remoteDir = '/tmp/deployment-' + this.deploymentId
      this.log(`📂 远程执行目录: ${remoteDir}`)

      // 构建远程脚本，包含执行位置确认
      let remoteScript = `echo "🌐 ===== 远程主机执行开始 ====="
echo "🎯 执行主机: $(hostname)"
echo "📂 当前目录: $(pwd)"
echo "👤 当前用户: $(whoami)"
echo "🕐 执行时间: $(date)"
echo ""
mkdir -p ${remoteDir}
cd ${remoteDir}
echo "📂 切换到执行目录: $(pwd)"
echo ""
`

      // 添加环境变量
      if (environment) {
        this.log('🌍 设置远程环境变量:')
        for (const [key, value] of Object.entries(environment)) {
          remoteScript += `export ${key}="${value}"\n`
          this.log(`   ${key}=${value}`)
        }
        remoteScript += `echo "🌍 环境变量设置完成"\necho ""\n`
      }

      // 添加实际的部署脚本
      remoteScript += `echo "🚀 开始执行部署脚本..."
${script}
echo ""
echo "✅ 部署脚本执行完成"
echo "🌐 ===== 远程主机执行结束 ====="`

      this.log('📡 发送脚本到远程主机执行...')
      this.log('📜 远程执行脚本预览:')
      this.log(remoteScript.split('\n').map(line => `   ${line}`).join('\n'))

      await this.executeRemoteCommand(remoteScript)
      this.log('✅ 远程部署脚本执行完成')
    }
  }

  /**
   * 构建远程执行脚本
   */
  private buildRemoteScript(script: string, environment?: Record<string, string>): string {
    let remoteScript = ''

    // 添加环境变量
    if (environment) {
      for (const [key, value] of Object.entries(environment)) {
        remoteScript += `export ${key}="${value}"; `
      }
    }

    // 添加脚本内容
    remoteScript += script

    return remoteScript
  }

  /**
   * 构建SSH命令参数
   */
  private buildSSHArgs(script: string): string[] {
    const args: string[] = []

    // SSH连接选项
    args.push('-o', 'StrictHostKeyChecking=no')
    args.push('-o', 'UserKnownHostsFile=/dev/null')
    args.push('-o', 'LogLevel=ERROR')

    // 端口
    if (this.hostInfo.port && this.hostInfo.port !== 22) {
      args.push('-p', this.hostInfo.port.toString())
    }

    // 认证方式
    if (this.hostInfo.authType === 'key' && this.hostInfo.keyPath) {
      args.push('-i', this.hostInfo.keyPath)
    }

    // 目标主机
    args.push(`${this.hostInfo.username}@${this.hostInfo.host}`)

    // 要执行的脚本
    args.push(script)

    return args
  }

  /**
   * 强制删除目录（用于Git克隆前的目录清理）
   */
  private async forceRemoveDirectory(targetDir: string): Promise<void> {
    try {
      if (!fs.existsSync(targetDir)) {
        this.log(`📁 目录不存在，无需删除: ${targetDir}`)
        return
      }

      const absoluteTargetDir = path.resolve(targetDir)
      this.log(`🗑️ 强制删除目录: ${absoluteTargetDir}`)

      // 使用系统命令强制删除，处理权限和锁定文件问题
      if (process.platform === 'win32') {
        // Windows系统
        await this.executeCommand('rmdir', ['/s', '/q', absoluteTargetDir], process.cwd())
      } else {
        // Unix/Linux/macOS系统
        await this.executeCommand('rm', ['-rf', absoluteTargetDir], process.cwd())
      }

      // 验证删除是否成功
      if (fs.existsSync(absoluteTargetDir)) {
        this.log('⚠️ 常规删除未完全成功，尝试sudo删除...')
        await this.executeCommand('sudo', ['rm', '-rf', absoluteTargetDir], process.cwd())
      }

      this.log('✅ 目录强制删除完成')
    } catch (error) {
      this.log(`❌ 强制删除目录失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  /**
   * 深度清理目录（处理Git仓库和隐藏文件）
   */
  private async deepCleanDirectory(targetDir: string): Promise<void> {
    try {
      if (!fs.existsSync(targetDir)) {
        this.log(`📁 目录不存在，无需清理: ${targetDir}`)
        return
      }

      const absoluteTargetDir = path.resolve(targetDir)
      this.log(`🧹 深度清理目录: ${absoluteTargetDir}`)

      // 1. 尝试重置Git仓库权限（如果是Git仓库）
      const gitDir = path.join(absoluteTargetDir, '.git')
      if (fs.existsSync(gitDir)) {
        this.log('📦 检测到Git仓库，重置权限...')
        try {
          if (process.platform !== 'win32') {
            await this.executeCommand('chmod', ['-R', '755', absoluteTargetDir], process.cwd())
          }
        } catch (chmodError) {
          this.log('⚠️ 权限重置失败，继续清理...')
        }
      }

      // 2. 强制删除所有内容，包括隐藏文件
      if (process.platform === 'win32') {
        // Windows系统
        await this.executeCommand('cmd', ['/c', `rmdir /s /q "${absoluteTargetDir}"`], process.cwd())
      } else {
        // Unix/Linux/macOS系统
        await this.executeCommand('rm', ['-rf', absoluteTargetDir], process.cwd())
      }

      // 3. 验证清理结果
      if (fs.existsSync(absoluteTargetDir)) {
        this.log('⚠️ 深度清理未完全成功，使用最终手段...')

        // 最后的手段：逐个删除文件
        const items = fs.readdirSync(absoluteTargetDir, { withFileTypes: true })
        for (const item of items) {
          const itemPath = path.join(absoluteTargetDir, item.name)
          try {
            if (item.isDirectory()) {
              await this.executeCommand('rm', ['-rf', itemPath], process.cwd())
            } else {
              fs.unlinkSync(itemPath)
            }
          } catch (itemError) {
            this.log(`⚠️ 删除项目失败: ${item.name}`)
          }
        }

        // 最后删除空目录
        try {
          fs.rmdirSync(absoluteTargetDir)
        } catch (rmdirError) {
          this.log('⚠️ 删除空目录失败，但继续执行...')
        }
      }

      this.log('✅ 深度清理完成')
    } catch (error) {
      this.log(`❌ 深度清理失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  /**
   * 安全删除目录（避免删除当前工作目录）
   */
  private async safeRemoveDirectory(targetDir: string): Promise<void> {
    try {
      // 检查目录是否存在
      if (!fs.existsSync(targetDir)) {
        this.log(`📁 目录不存在，跳过删除: ${targetDir}`)
        return
      }

      // 获取当前工作目录和目标目录的绝对路径
      const currentDir = process.cwd()
      const absoluteTargetDir = path.resolve(targetDir)

      this.log(`🗑️ 准备删除目录: ${absoluteTargetDir}`)

      // 检查是否试图删除当前工作目录或其父目录
      if (absoluteTargetDir === currentDir || currentDir.startsWith(absoluteTargetDir + path.sep)) {
        this.log('⚠️ 检测到试图删除当前工作目录，使用安全删除方式...')

        // 切换到父目录
        const parentDir = path.dirname(absoluteTargetDir)
        process.chdir(parentDir)
        this.log(`📂 切换到父目录: ${parentDir}`)

        // 现在安全删除目标目录
        await this.executeCommand('rm', ['-rf', path.basename(absoluteTargetDir)], parentDir)

        // 切换回原来的工作目录
        process.chdir(currentDir)
        this.log(`📂 切换回原工作目录: ${currentDir}`)
      } else {
        // 直接删除
        await this.executeCommand('rm', ['-rf', absoluteTargetDir], currentDir)
      }

      this.log('✅ 目录删除完成')
    } catch (error) {
      this.log(`❌ 目录删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  /**
   * 判断是否是Git的正常输出（非错误信息）
   */
  private isGitNormalOutput(output: string): boolean {
    const normalPatterns = [
      /^From\s+https?:\/\//, // Git fetch的远程仓库信息
      /^From\s+git@/, // SSH方式的远程仓库信息
      /^\s*\*\s+\[new branch\]/, // 新分支信息
      /^\s*\*\s+branch\s+/, // 分支信息
      /^remote:\s+/, // 远程仓库信息
      /^Receiving objects:/, // 接收对象进度
      /^Resolving deltas:/, // 解析增量进度
      /^Counting objects:/, // 计算对象进度
      /^Compressing objects:/, // 压缩对象进度
      /^\d+%\s+\(\d+\/\d+\)/, // 进度百分比
      /^Total\s+\d+/, // 总计信息
      /^Unpacking objects:/, // 解包对象
      /^Already up to date/, // 已经是最新
      /^Already up-to-date/, // 已经是最新（旧版本Git）
      /^Fast-forward/, // 快进合并
      /^Updating\s+[a-f0-9]+\.\.[a-f0-9]+/, // 更新提交范围
      /^\s+[a-f0-9]+\.\.[a-f0-9]+\s+/, // 提交范围
      /^HEAD is now at/, // HEAD位置信息
      /^Switched to branch/, // 切换分支
      /^Switched to a new branch/, // 切换到新分支
      /^Your branch is up to date/, // 分支是最新的
      /^Note:/, // Git提示信息
      /^hint:/, // Git提示信息
      /^warning: redirecting to/, // 重定向警告（通常不是错误）
    ]

    return normalPatterns.some(pattern => pattern.test(output.trim()))
  }

  /**
   * 翻译Git命令输出为中文
   */
  private translateOutput(output: string): string {
    if (!output || output.trim() === '') return output

    const translations: Record<string, string> = {
      // Git状态相关
      'On branch': '当前分支：',
      'Your branch is behind': '您的分支落后于',
      'by 1 commit': '1个提交',
      'by (\\d+) commits': '$1个提交',
      'and can be fast-forwarded': '，可以快进合并',
      'use "git pull" to update': '使用 "git pull" 更新',
      'Changes not staged for commit': '尚未暂存以备提交的变更：',
      'use "git add <file>..." to update': '使用 "git add <文件>..." 更新要提交的内容',
      'use "git restore <file>..." to discard': '使用 "git restore <文件>..." 丢弃工作目录的改动',
      'modified:': '已修改：',
      'Untracked files:': '未跟踪的文件：',
      'use "git add <file>..." to include': '使用 "git add <文件>..." 以包含要提交的内容',
      'no changes added to commit': '没有变更添加到提交',
      'use "git add" and/or "git commit -a"': '使用 "git add" 和/或 "git commit -a"',

      // Git操作进度信息
      'From': '来自远程仓库：',
      'Receiving objects:': '接收对象：',
      'Resolving deltas:': '解析增量：',
      'Counting objects:': '计算对象：',
      'Compressing objects:': '压缩对象：',
      'Unpacking objects:': '解包对象：',
      'Total': '总计',
      'Already up to date': '已经是最新版本',
      'Already up-to-date': '已经是最新版本',
      'Fast-forward': '快进合并',
      'HEAD is now at': 'HEAD 现在位于',
      'Switched to branch': '切换到分支',
      'Switched to a new branch': '切换到新分支',
      'Your branch is up to date': '您的分支是最新的',

      // Git克隆相关
      'Cloning into': '正在克隆到',
      'remote:': '远程：',
      'done.': '完成。',

      // Git操作相关
      'Refusing to remove current working directory': '拒绝删除当前工作目录',
      'fatal:': '致命错误：',
      'error:': '错误：',
      'warning:': '警告：',

      // 网络相关
      'Empty reply from server': '服务器返回空响应',
      'Connection refused': '连接被拒绝',
      'Could not resolve host': '无法解析主机',
      'Authentication failed': '认证失败',
      'HTTP Basic: Access denied': 'HTTP基本认证：访问被拒绝',

      // 文件操作
      'Permission denied': '权限被拒绝',
      'No such file or directory': '没有那个文件或目录',
      'Directory not empty': '目录非空',

      // 其他常见提示
      'Merge made by': '合并由以下方式完成',
      'Automatic merge failed': '自动合并失败'
    }

    let translatedOutput = output

    // 应用翻译规则
    for (const [english, chinese] of Object.entries(translations)) {
      const regex = new RegExp(english, 'gi')
      translatedOutput = translatedOutput.replace(regex, chinese)
    }

    return translatedOutput
  }

  /**
   * 验证部署结果
   */
  private async verifyDeployment() {
    this.log('🔍 验证部署结果...')

    // 简单的验证逻辑
    try {
      // 检查是否有相关进程在运行
      await this.executeScript('ps aux | grep -v grep | grep -E "(node|nginx|apache|java)" | wc -l')
      this.log('✅ 部署验证完成')
    } catch (error) {
      this.log('⚠️ 无法验证部署结果，但部署脚本已执行完成')
    }
  }

  /**
   * 记录日志
   */
  private log(message: string) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    this.logs.push(logMessage)
    console.log(`[Deployment ${this.deploymentId}] ${logMessage}`)
  }

  /**
   * 实时更新数据库中的部署日志
   */
  private async updateDeploymentLogs(newLog: string) {
    try {
      const prisma = await getPrismaClient()
      
      // 获取当前日志
      const deployment = await prisma.deployment.findUnique({
        where: { id: this.deploymentId },
        select: { logs: true }
      })

      if (deployment) {
        const updatedLogs = (deployment.logs || '') + newLog + '\n'
        
        await prisma.deployment.update({
          where: { id: this.deploymentId },
          data: { logs: updatedLogs }
        })
      }
    } catch (error) {
      console.error('更新部署日志失败:', error)
    }
  }

  /**
   * 立即更新部署状态为失败
   */
  private async updateDeploymentStatusToFailed(errorMessage: string): Promise<void> {
    try {
      const prisma = await getPrismaClient()

      const failedLogs = this.logs.join('\n') + '\n❌ 部署失败: ' + errorMessage

      await prisma.deployment.upsert({
        where: { id: this.deploymentId },
        update: {
          status: 'failed',
          completedAt: new Date(),
          logs: failedLogs
        },
        create: {
          id: this.deploymentId,
          projectId: 'unknown',
          name: '失败的部署',
          environment: 'dev',
          status: 'failed',
          completedAt: new Date(),
          logs: failedLogs,
          userId: 'system'
        }
      })

      console.log('✅ 部署状态已更新为失败')
    } catch (error) {
      console.error('❌ 更新部署状态失败:', error)
    }
  }
}

/**
 * 执行部署任务的主函数
 */
export async function executeDeployment(deploymentId: string): Promise<DeploymentResult> {
  const prisma = await getPrismaClient()
  
  // 获取部署任务信息
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: {
      // 基本字段
      id: true,
      name: true,
      environment: true,
      deployScript: true,
      buildNumber: true,
      // Jenkins相关字段
      isJenkinsDeployment: true,
      jenkinsJobId: true,
      jenkinsJobName: true,
      jenkinsJobIds: true,
      // 关联项目信息
      project: {
        select: {
          id: true,
          name: true,
          buildScript: true,
          deployScript: true,
          repositoryUrl: true,
          branch: true,
          serverId: true // 获取项目配置的主机ID
        }
      }
    }
  })

  if (!deployment) {
    throw new Error(`部署任务不存在: ${deploymentId}`)
  }

  // Git认证配置处理
  let gitCredentials: DeploymentConfig['gitCredentials'] = undefined

  // 如果有仓库URL，检查是否需要认证（安全访问project）
  if (deployment.project?.repositoryUrl) {
    const repoUrl = deployment.project.repositoryUrl

    // 检查是否是私有仓库（需要认证）
    if (repoUrl.includes('git.ope.ai') || repoUrl.includes('gitlab') || repoUrl.includes('github.com')) {

      // 1. 优先尝试从用户配置获取Git认证信息
      try {
        const userCredentials = await GitCredentialService.getProjectCredentials(deployment.project.id)
        if (userCredentials && userCredentials.token) {
          gitCredentials = {
            type: 'token',
            token: userCredentials.token
          }
          console.log('🔐 使用用户配置的Git Token认证')
        } else if (userCredentials && userCredentials.username && userCredentials.password) {
          gitCredentials = {
            type: 'username_password',
            username: userCredentials.username,
            password: userCredentials.password
          }
          console.log('🔐 使用用户配置的Git用户名密码认证')
        }
      } catch (error) {
        console.log('⚠️ 获取用户Git认证信息失败:', error)
      }

      // 2. 如果用户没有配置认证信息，记录警告并尝试无认证访问
      if (!gitCredentials) {
        console.log('⚠️ 用户未配置Git认证信息')
        console.log('💡 建议：在系统中添加Git认证配置以访问私有仓库')
        console.log('📝 支持的认证方式：GitHub Token、GitLab Token、用户名密码、SSH密钥')
      }
    } else {
      console.log('📂 检测到公共仓库，无需认证')
    }
  }

  // 获取关联的主机信息
  // 优先使用项目配置的主机ID，如果没有则使用本地主机（安全访问project）
  const hostId = deployment.project?.serverId || 'localhost'

  console.log('🎯 部署配置信息:', {
    deploymentId,
    projectName: deployment.project?.name || 'Jenkins任务',
    repositoryUrl: deployment.project?.repositoryUrl || null,
    branch: deployment.project?.branch || 'main',
    projectServerId: deployment.project?.serverId || null,
    finalHostId: hostId,
    hasGitCredentials: !!gitCredentials,
    isJenkinsDeployment: deployment.isJenkinsDeployment || false,
    jenkinsJobName: deployment.jenkinsJobName || null,
    // 添加脚本配置信息
    hasBuildScript: !!deployment.project?.buildScript,
    hasDeployScript: !!(deployment.deployScript || deployment.project?.deployScript),
    deploymentDeployScript: deployment.deployScript ? '已配置' : '未配置',
    projectDeployScript: deployment.project?.deployScript ? '已配置' : '未配置',
    // 添加远程部署配置信息
    useRemoteProject: true,
    remoteProjectPath: `/var/www/${deployment.project?.name || deployment.jenkinsJobName || 'app'}`
  })

  const executor = new DeploymentExecutor(deploymentId, deployment.project?.repositoryUrl)

  const config: DeploymentConfig = {
    deploymentId,
    hostId,
    buildScript: deployment.project?.buildScript || undefined,
    deployScript: deployment.deployScript || deployment.project?.deployScript || undefined,
    repositoryUrl: deployment.project?.repositoryUrl || undefined,
    branch: deployment.project?.branch || 'main',
    gitCredentials,
    workingDirectory: '/tmp/deployment',
    // 远程部署配置
    useRemoteProject: true, // 默认使用远程项目目录模式
    remoteProjectPath: `/var/www/${deployment.project?.name || deployment.jenkinsJobName || 'app'}`, // 基于项目名或Jenkins任务名生成远程路径
    environment: {
      NODE_ENV: deployment.environment,
      DEPLOYMENT_ID: deploymentId,
      PROJECT_NAME: deployment.project?.name || deployment.jenkinsJobName || 'unknown-project',
      BUILD_NUMBER: deployment.buildNumber?.toString() || 'latest',
      GIT_BRANCH: deployment.project?.branch || 'main',
      // Jenkins相关环境变量
      IS_JENKINS_DEPLOYMENT: deployment.isJenkinsDeployment ? 'true' : 'false',
      JENKINS_JOB_ID: deployment.jenkinsJobId || '',
      JENKINS_JOB_NAME: deployment.jenkinsJobName || ''
    },
    timeout: 300000 // 5分钟超时
  }

  return await executor.execute(config)
}
