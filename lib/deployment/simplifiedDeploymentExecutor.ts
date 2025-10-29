import { getPrismaClient } from '../config/database'
import { spawn } from 'child_process'

interface HostInfo {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  keyPath?: string
  authType: string
}

interface DeploymentConfig {
  id: string
  name: string
  deployScript: string
  serverId?: string
}

/**
 * 简化的部署执行器
 * 专注于执行部署脚本，不处理代码管理
 */
export class SimplifiedDeploymentExecutor {
  private deploymentId: string
  private logs: string[] = []
  private hostInfo?: HostInfo
  private config: DeploymentConfig

  constructor(deploymentId: string, config: DeploymentConfig) {
    this.deploymentId = deploymentId
    this.config = config
  }

  /**
   * 执行部署
   */
  async execute(): Promise<{ success: boolean; logs: string; duration: number }> {
    const startTime = Date.now()
    
    try {
      this.log('🚀 开始简化部署流程')
      this.log(`📋 部署任务: ${this.config.name}`)
      
      // 1. 获取主机信息（如果配置了远程主机）
      if (this.config.serverId) {
        await this.loadHostInfo(this.config.serverId)
        this.log(`🖥️ 目标主机: ${this.hostInfo?.name} (${this.hostInfo?.host})`)
      } else {
        this.log('🏠 本地部署模式')
      }

      // 2. 验证部署脚本
      if (!this.config.deployScript || this.config.deployScript.trim() === '') {
        throw new Error('部署脚本为空，请在项目配置中设置部署脚本')
      }

      this.log('📝 部署脚本验证通过')
      this.log(`🔧 即将执行: ${this.config.deployScript}`)

      // 3. 执行部署脚本
      this.log('⚡ 开始执行部署脚本')
      await this.executeDeploymentScript()
      
      // 4. 部署完成
      this.log('🎉 部署执行完成')
      
      const duration = Date.now() - startTime
      this.log(`⏱️ 总耗时: ${Math.round(duration / 1000)}秒`)

      return {
        success: true,
        logs: this.logs.join('\n'),
        duration
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      this.log(`❌ 部署失败: ${errorMessage}`)
      
      const duration = Date.now() - startTime
      return {
        success: false,
        logs: this.logs.join('\n'),
        duration
      }
    }
  }

  /**
   * 执行部署脚本
   */
  private async executeDeploymentScript(): Promise<void> {
    if (this.hostInfo) {
      // 远程执行
      this.log('🌐 在远程主机上执行部署脚本')
      await this.executeRemoteCommand(this.config.deployScript)
    } else {
      // 本地执行
      this.log('🏠 在本地执行部署脚本')
      await this.executeLocalCommand(this.config.deployScript)
    }
  }

  /**
   * 执行远程命令
   */
  private async executeRemoteCommand(command: string): Promise<string> {
    if (!this.hostInfo) {
      throw new Error('主机信息未配置')
    }

    // 检查是否有密码，如果有则使用sshpass
    if (this.hostInfo.password && !this.hostInfo.keyPath) {
      this.log('🔐 使用密码认证执行远程命令')
      
      const sshpassArgs = [
        '-p', this.hostInfo.password,
        'ssh',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR'
      ]

      if (this.hostInfo.port && this.hostInfo.port !== 22) {
        sshpassArgs.push('-p', this.hostInfo.port.toString())
      }

      sshpassArgs.push(`${this.hostInfo.username}@${this.hostInfo.host}`)
      sshpassArgs.push(command)

      return await this.executeCommand('sshpass', sshpassArgs)
    } else {
      // 使用密钥认证或无密码认证
      this.log('🔑 使用密钥认证执行远程命令')
      
      const sshArgs = [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR'
      ]

      if (this.hostInfo.port && this.hostInfo.port !== 22) {
        sshArgs.push('-p', this.hostInfo.port.toString())
      }

      if (this.hostInfo.keyPath) {
        sshArgs.push('-i', this.hostInfo.keyPath)
      }

      sshArgs.push(`${this.hostInfo.username}@${this.hostInfo.host}`)
      sshArgs.push(command)

      return await this.executeCommand('ssh', sshArgs)
    }
  }

  /**
   * 执行本地命令
   */
  private async executeLocalCommand(command: string): Promise<string> {
    return await this.executeCommand('sh', ['-c', command])
  }

  /**
   * 执行命令
   */
  private async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.log(`🔧 执行命令: ${command} ${args.join(' ')}`)

      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        // 实时输出到日志
        output.split('\n').forEach((line: string) => {
          if (line.trim()) {
            this.log(`📤 ${line}`)
          }
        })
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        // 实时输出错误到日志
        output.split('\n').forEach((line: string) => {
          if (line.trim()) {
            this.log(`⚠️ ${line}`)
          }
        })
      })

      child.on('close', (code) => {
        if (code === 0) {
          this.log('✅ 命令执行成功')
          resolve(stdout)
        } else {
          const errorMsg = `命令执行失败 (退出码: ${code}): ${stderr || '未知错误'}`
          this.log(`❌ ${errorMsg}`)
          reject(new Error(errorMsg))
        }
      })

      child.on('error', (error) => {
        const errorMsg = `命令执行异常: ${error.message}`
        this.log(`❌ ${errorMsg}`)
        reject(new Error(errorMsg))
      })
    })
  }

  /**
   * 加载主机信息
   */
  private async loadHostInfo(serverId: string): Promise<void> {
    try {
      const prisma = await getPrismaClient()
      
      const host = await prisma.server.findUnique({
        where: { id: serverId },
        select: {
          id: true,
          name: true,
          hostname: true,
          ip: true,
          port: true,
          username: true,
          password: true,
          keyPath: true
        }
      })

      if (!host) {
        throw new Error(`主机配置不存在: ${serverId}`)
      }

      this.hostInfo = {
        id: host.id,
        name: host.name,
        host: host.ip || host.hostname,
        port: host.port || 22,
        username: host.username || 'root',
        password: host.password || undefined,
        keyPath: host.keyPath || undefined,
        authType: host.keyPath ? 'key' : 'password'
      }

      this.log(`✅ 主机信息加载成功: ${this.hostInfo.name}`)
    } catch (error) {
      throw new Error(`加载主机信息失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 记录日志
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}`
    this.logs.push(logEntry)
    console.log(logEntry)
  }

  /**
   * 获取当前日志
   */
  getLogs(): string {
    return this.logs.join('\n')
  }
}
