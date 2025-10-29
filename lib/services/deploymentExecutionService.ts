import { getPrismaClient } from '../config/database'
import { notificationService } from './notificationService'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { DeploymentExecutor, DeploymentConfig } from '../deployment/deploymentExecutor'
import { createJenkinsClient } from '../jenkins/client'

const execAsync = promisify(exec)

export interface DeploymentExecutionContext {
  deploymentId: string
  deployment: any
  build: any
  template: any
  hosts: any[]
  user: any
}

export interface DeploymentResult {
  success: boolean
  duration: number
  logs: string
  error?: string
  artifacts?: any
}

/**
 * 部署执行服务 - 处理自动部署执行逻辑
 */
export class DeploymentExecutionService {
  private prisma: any

  constructor() {
    this.prisma = null
  }

  private async getPrisma() {
    if (!this.prisma) {
      this.prisma = await getPrismaClient()
    }
    return this.prisma
  }

  /**
   * 触发自动部署执行
   */
  async triggerDeployment(deploymentId: string): Promise<boolean> {
    try {
      const prisma = await this.getPrisma()

      console.log(`🚀 触发自动部署: ${deploymentId}`)

      // 获取部署任务详细信息
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: {
          // 部署任务基本信息
          id: true,
          name: true,
          status: true,
          environment: true,
          version: true,
          deploymentHosts: true,
          deployScript: true,
          // Jenkins相关字段
          isJenkinsDeployment: true,
          jenkinsJobId: true,
          jenkinsJobName: true,
          jenkinsJobIds: true,
          // 关联信息
          project: {
            select: {
              id: true,
              name: true,
              repositoryUrl: true,
              branch: true,
              buildScript: true,
              deployScript: true
            }
          },
          build: {
            select: {
              id: true,
              buildNumber: true,
              artifacts: true,
              jenkinsJobName: true
            }
          },
          template: {
            select: {
              id: true,
              name: true,
              deployScript: true,
              rollbackScript: true,
              config: true
            }
          },
          user: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })

      if (!deployment) {
        console.error('❌ 部署任务不存在')
        return false
      }

      if (deployment.status !== 'approved') {
        console.error('❌ 部署任务未审批通过，无法执行')
        return false
      }

      // 获取部署主机信息
      const hostIds = deployment.deploymentHosts as string[] || []
      console.log(`🎯 部署主机ID列表: ${JSON.stringify(hostIds)}`)

      if (hostIds.length === 0) {
        console.error('❌ 未配置部署主机')
        await this.updateDeploymentStatus(deploymentId, 'failed', '未配置部署主机')
        return false
      }

      const hosts = await prisma.server.findMany({
        where: {
          id: { in: hostIds }
        },
        select: {
          id: true,
          name: true,
          hostname: true,
          ip: true,
          port: true,
          username: true,
          password: true,      // 添加密码字段
          keyPath: true,       // 添加密钥路径字段
          authType: true,      // 添加认证类型字段
          status: true
        }
      })

      console.log(`🔍 查询到的主机信息: ${JSON.stringify(hosts.map((h: any) => ({
        id: h.id,
        name: h.name,
        authType: h.authType,
        ip: h.ip,
        hostname: h.hostname
      })))}`)

      if (hosts.length === 0) {
        console.error('❌ 未找到可用的部署主机')
        await this.updateDeploymentStatus(deploymentId, 'failed', '未找到可用的部署主机')
        return false
      }

      // 验证主机状态
      const offlineHosts = hosts.filter((h: any) => h.status === 'offline')
      if (offlineHosts.length > 0) {
        console.error(`❌ 部分主机离线: ${offlineHosts.map((h: any) => h.name).join(', ')}`)
        await this.updateDeploymentStatus(deploymentId, 'failed', `部分主机离线: ${offlineHosts.map((h: any) => h.name).join(', ')}`)
        return false
      }

      // 构建执行上下文
      const context: DeploymentExecutionContext = {
        deploymentId,
        deployment,
        build: deployment.build,
        template: deployment.template,
        hosts,
        user: deployment.user
      }

      // 更新部署状态为执行中
      await this.updateDeploymentStatus(deploymentId, 'deploying', '开始执行部署')

      // 发送部署开始通知
      await this.sendDeploymentNotification(context, 'deploying')

      // 执行部署
      const result = await this.executeDeployment(context)

      // 更新部署结果
      if (result.success) {
        await this.updateDeploymentStatus(deploymentId, 'success', '部署成功完成', result)
        await this.sendDeploymentNotification(context, 'success')
      } else {
        await this.updateDeploymentStatus(deploymentId, 'failed', result.error || '部署执行失败', result)
        await this.sendDeploymentNotification(context, 'failed')
      }

      return result.success

    } catch (error) {
      console.error('❌ 触发自动部署失败:', error)
      await this.updateDeploymentStatus(deploymentId, 'failed', `部署执行异常: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  /**
   * 执行部署任务
   */
  private async executeDeployment(context: DeploymentExecutionContext): Promise<DeploymentResult> {
    const startTime = Date.now()
    let logs = ''

    try {
      console.log(`📦 开始执行部署: ${context.deployment.name}`)

      // 创建部署工作目录
      const workDir = await this.createWorkDirectory(context.deploymentId)
      logs += `创建工作目录: ${workDir}\n`

      // 准备部署脚本
      const deployScript = this.prepareDeployScript(context)
      logs += `准备部署脚本完成\n`

      // 执行部署到每个主机
      const deploymentResults = []
      
      for (const host of context.hosts) {
        console.log(`🎯 部署到主机: ${host.name} (${host.ip})`)
        logs += `\n=== 部署到主机: ${host.name} ===\n`

        try {
          const hostResult = await this.deployToHost(context, host, deployScript, workDir)
          deploymentResults.push(hostResult)
          logs += hostResult.logs
          
          if (!hostResult.success) {
            logs += `❌ 主机 ${host.name} 部署失败: ${hostResult.error}\n`
          } else {
            logs += `✅ 主机 ${host.name} 部署成功\n`
          }
        } catch (hostError) {
          const errorMsg = `主机 ${host.name} 部署异常: ${hostError instanceof Error ? hostError.message : String(hostError)}`
          logs += `❌ ${errorMsg}\n`
          deploymentResults.push({
            success: false,
            error: errorMsg,
            logs: errorMsg
          })
        }
      }

      // 清理工作目录
      await this.cleanupWorkDirectory(workDir)
      logs += `清理工作目录完成\n`

      // 检查部署结果
      const failedDeployments = deploymentResults.filter(r => !r.success)
      const success = failedDeployments.length === 0

      const duration = Date.now() - startTime

      if (success) {
        logs += `\n🎉 所有主机部署成功完成！耗时: ${duration}ms\n`
      } else {
        logs += `\n❌ ${failedDeployments.length}/${deploymentResults.length} 个主机部署失败\n`
      }

      return {
        success,
        duration,
        logs,
        error: success ? undefined : `${failedDeployments.length} 个主机部署失败`,
        artifacts: {
          deploymentResults,
          totalHosts: context.hosts.length,
          successfulHosts: deploymentResults.filter(r => r.success).length,
          failedHosts: failedDeployments.length
        }
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMsg = `部署执行异常: ${error instanceof Error ? error.message : String(error)}`
      logs += `\n❌ ${errorMsg}\n`

      return {
        success: false,
        duration,
        logs,
        error: errorMsg
      }
    }
  }

  /**
   * 部署到单个主机
   */
  private async deployToHost(
    context: DeploymentExecutionContext,
    host: any,
    deployScript: string,
    workDir: string
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    try {
      let logs = ''

      // 使用传入的主机信息（已包含认证信息）
      logs += `🎯 目标主机: ${host.name} (${host.ip || host.hostname})\n`
      logs += `🔐 认证类型: ${host.authType}\n`

      // 检查是否有Git仓库配置（支持Jenkins部署任务和普通部署任务）
      const repositoryUrl = context.deployment.project?.repositoryUrl
      const hasGitRepository = repositoryUrl && repositoryUrl.trim() !== ''

      if (hasGitRepository) {
        logs += `📦 检测到Git仓库，使用完整CI/CD流程\n`
        logs += `🔗 仓库地址: ${repositoryUrl}\n`

        // 构建部署配置
        const deployConfig: DeploymentConfig = {
          deploymentId: context.deploymentId,
          hostId: host.id,
          deploymentHosts: [host.id],
          repositoryUrl: repositoryUrl,
          branch: context.deployment.project?.branch || 'main',
          buildScript: context.deployment.project?.buildScript || undefined,
          deployScript: deployScript,
          gitCredentials: context.deployment.project?.id ? await this.getGitCredentials(context.deployment.project.id) : undefined,
          environment: {
            DEPLOYMENT_ID: context.deploymentId,
            HOST_NAME: host.name,
            HOST_IP: host.ip || host.hostname,
            HOST_PORT: host.port?.toString() || '22',
            HOST_USER: host.username || 'root',
            BUILD_NUMBER: context.build?.buildNumber?.toString() || '',
            PROJECT_NAME: context.deployment.project?.name || context.deployment.name || 'unknown',
            ENVIRONMENT: context.deployment.environment,
            VERSION: context.deployment.version || '',
            // Jenkins相关环境变量
            IS_JENKINS_DEPLOYMENT: context.deployment.isJenkinsDeployment ? 'true' : 'false',
            JENKINS_JOB_ID: context.deployment.jenkinsJobId || '',
            JENKINS_JOB_NAME: context.deployment.jenkinsJobName || ''
          }
        }

        console.log('🔍 部署配置详情:', {
          deploymentId: deployConfig.deploymentId,
          repositoryUrl: deployConfig.repositoryUrl,
          branch: deployConfig.branch,
          hasProject: !!context.deployment.project,
          isJenkinsDeployment: context.deployment.isJenkinsDeployment
        })

        // 使用DeploymentExecutor执行完整流程
        const executor = new DeploymentExecutor(context.deploymentId, deployConfig.repositoryUrl)
        const result = await executor.execute(deployConfig)

        logs += result.logs

        if (!result.success) {
          throw new Error(result.error || 'DeploymentExecutor执行失败')
        }
      } else {
        // 没有Git仓库，直接执行部署脚本
        logs += `📜 直接执行部署脚本（无Git仓库）\n`

        // 检查是否是Jenkins部署任务
        if (context.deployment.isJenkinsDeployment) {
          logs += `🔧 检测到Jenkins部署任务，调用Jenkins API执行\n`
          logs += `📋 Jenkins任务: ${context.deployment.jenkinsJobName || context.deployment.jenkinsJobId || '未知'}\n`

          // 调用Jenkins API执行任务
          const jenkinsResult = await this.executeJenkinsDeployment(context)
          logs += jenkinsResult.logs

          if (!jenkinsResult.success) {
            throw new Error(jenkinsResult.error || 'Jenkins任务执行失败')
          }

          return {
            success: true,
            logs
          }
        }

        // 根据主机类型选择执行方式
        if (host.authType === 'local') {
          // 本地主机执行
          logs += `💻 在本地主机执行部署脚本\n`
          const { stdout, stderr } = await execAsync(deployScript, {
            cwd: workDir,
            timeout: 300000, // 5分钟超时
            env: {
              ...process.env,
              DEPLOYMENT_ID: context.deploymentId,
              HOST_NAME: host.name,
              HOST_IP: host.ip || host.hostname,
              HOST_PORT: host.port?.toString() || '22',
              HOST_USER: host.username || 'root',
              BUILD_NUMBER: context.build?.buildNumber?.toString() || '',
              PROJECT_NAME: context.deployment.project?.name || context.deployment.name || 'unknown',
              // Jenkins相关环境变量
              IS_JENKINS_DEPLOYMENT: context.deployment.isJenkinsDeployment ? 'true' : 'false',
              JENKINS_JOB_ID: context.deployment.jenkinsJobId || '',
              JENKINS_JOB_NAME: context.deployment.jenkinsJobName || ''
            }
          })

          logs += `脚本执行输出:\n${stdout}\n`
          if (stderr) {
            logs += `脚本错误输出:\n${stderr}\n`
          }
        } else {
          // 远程主机执行
          logs += `🌐 在远程主机执行部署脚本\n`
          const remoteResult = await this.executeRemoteDeployment(host, deployScript, context, workDir)
          logs += remoteResult.logs

          if (!remoteResult.success) {
            throw new Error(remoteResult.error || '远程部署失败')
          }
        }
      }

      return {
        success: true,
        logs
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        logs: `执行失败: ${errorMessage}\n`,
        error: errorMessage
      }
    }
  }

  /**
   * 获取项目的Git认证信息
   */
  private async getGitCredentials(projectId: string): Promise<DeploymentConfig['gitCredentials']> {
    try {
      const prisma = await this.getPrisma()

      // 先查询项目信息，获取关联的Git认证配置ID
      const project = await prisma.cICDProject.findUnique({
        where: { id: projectId },
        select: {
          gitCredentialId: true,
          name: true
        }
      })

      if (!project) {
        console.log(`❌ 项目 ${projectId} 不存在`)
        return undefined
      }

      if (!project.gitCredentialId) {
        console.log(`⚠️ 项目 ${project.name} 未配置Git认证信息`)
        return undefined
      }

      // 查询Git认证配置详情
      const gitCredential = await prisma.gitCredential.findUnique({
        where: { id: project.gitCredentialId }
      })

      if (!gitCredential) {
        console.log(`❌ Git认证配置 ${project.gitCredentialId} 不存在`)
        return undefined
      }

      console.log(`🔐 找到项目Git认证配置: ${gitCredential.name} (${gitCredential.authType})`)

      // 解密认证信息
      let credentials: any = {}
      try {
        credentials = JSON.parse(gitCredential.encryptedCredentials)
      } catch (parseError) {
        console.error('❌ 解析认证信息失败:', parseError)
        return undefined
      }

      return {
        type: gitCredential.authType as 'username_password' | 'token' | 'ssh',
        username: credentials.username || undefined,
        password: credentials.password || undefined,
        token: credentials.token || undefined,
        privateKey: credentials.privateKey || undefined
      }

    } catch (error) {
      console.error('❌ 获取Git认证信息失败:', error)
      return undefined
    }
  }

  /**
   * 在远程主机执行部署
   */
  private async executeRemoteDeployment(
    hostInfo: any,
    deployScript: string,
    context: DeploymentExecutionContext,
    workDir: string
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    try {
      let logs = ''

      // 准备环境变量
      const envVars = {
        DEPLOYMENT_ID: context.deploymentId,
        HOST_NAME: hostInfo.name,
        HOST_IP: hostInfo.ip || hostInfo.hostname,
        HOST_PORT: hostInfo.port?.toString() || '22',
        HOST_USER: hostInfo.username || 'root',
        BUILD_NUMBER: context.build?.buildNumber?.toString() || '',
        PROJECT_NAME: context.deployment.project?.name || 'unknown',
        ENVIRONMENT: context.deployment.environment,
        VERSION: context.deployment.version || ''
      }

      // 构建远程执行脚本
      let remoteScript = '#!/bin/bash\nset -e\n\n'

      // 添加执行位置标识
      remoteScript += 'echo "🌐 ===== 远程主机执行开始 ====="\n'
      remoteScript += 'echo "🎯 执行主机: $(hostname)"\n'
      remoteScript += 'echo "📂 当前目录: $(pwd)"\n'
      remoteScript += 'echo "👤 当前用户: $(whoami)"\n'
      remoteScript += 'echo "🕐 执行时间: $(date)"\n'
      remoteScript += 'echo ""\n'

      // 添加环境变量
      for (const [key, value] of Object.entries(envVars)) {
        remoteScript += `export ${key}="${value}"\n`
      }

      remoteScript += '\necho "🌍 环境变量设置完成"\n'
      remoteScript += 'echo ""\n'
      remoteScript += '\n# 部署脚本开始\n'
      remoteScript += 'echo "🚀 开始执行部署脚本..."\n'
      remoteScript += deployScript
      remoteScript += '\necho ""\n'
      remoteScript += 'echo "✅ 部署脚本执行完成"\n'
      remoteScript += 'echo "🌐 ===== 远程主机执行结束 ====="\n'

      logs += `📜 准备远程执行脚本完成\n`
      logs += `🎯 目标主机: ${hostInfo.ip || hostInfo.hostname}:${hostInfo.port || 22}\n`
      logs += `👤 SSH用户: ${hostInfo.username || 'root'}\n`

      // 根据认证方式执行远程命令
      if (hostInfo.authType === 'password' && hostInfo.password) {
        // 使用密码认证
        logs += `🔐 使用密码认证连接远程主机\n`
        const result = await this.executeSSHWithPassword(hostInfo, remoteScript)
        logs += result.logs

        if (!result.success) {
          throw new Error(result.error)
        }
      } else if (hostInfo.authType === 'key' && hostInfo.keyPath) {
        // 使用密钥认证
        logs += `🔑 使用密钥认证连接远程主机\n`
        const result = await this.executeSSHWithKey(hostInfo, remoteScript)
        logs += result.logs

        if (!result.success) {
          throw new Error(result.error)
        }
      } else {
        throw new Error(`不支持的认证方式: ${hostInfo.authType}`)
      }

      return {
        success: true,
        logs
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        logs: `远程部署失败: ${errorMessage}\n`,
        error: errorMessage
      }
    }
  }

  /**
   * 使用密码认证执行SSH命令
   */
  private async executeSSHWithPassword(
    hostInfo: any,
    script: string
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    try {
      let logs = ''

      const host = hostInfo.ip || hostInfo.hostname
      const port = hostInfo.port || 22
      const username = hostInfo.username || 'root'

      logs += `🌐 连接到 ${username}@${host}:${port}\n`

      // 使用echo和管道的方式传递脚本内容，避免转义问题
      const encodedScript = Buffer.from(script).toString('base64')
      const sshCommand = `sshpass -p "${hostInfo.password}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p ${port} ${username}@${host} "echo '${encodedScript}' | base64 -d | bash"`

      logs += `🔧 执行SSH命令（使用base64编码传输脚本）\n`

      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout: 300000, // 5分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB缓冲区
      })

      logs += `✅ 远程命令执行完成\n`
      logs += `📋 执行输出:\n${stdout}\n`

      if (stderr && stderr.trim()) {
        logs += `⚠️ 错误输出:\n${stderr}\n`
      }

      return {
        success: true,
        logs
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        logs: `SSH密码认证执行失败: ${errorMessage}\n`,
        error: errorMessage
      }
    }
  }

  /**
   * 使用密钥认证执行SSH命令
   */
  private async executeSSHWithKey(
    hostInfo: any,
    script: string
  ): Promise<{ success: boolean; logs: string; error?: string }> {
    try {
      let logs = ''

      const host = hostInfo.ip || hostInfo.hostname
      const port = hostInfo.port || 22
      const username = hostInfo.username || 'root'

      logs += `🌐 连接到 ${username}@${host}:${port}\n`

      // 使用echo和管道的方式传递脚本内容，避免转义问题
      const encodedScript = Buffer.from(script).toString('base64')
      const sshCommand = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -p ${port} -i "${hostInfo.keyPath}" ${username}@${host} "echo '${encodedScript}' | base64 -d | bash"`

      logs += `🔧 执行SSH命令（使用base64编码传输脚本）\n`

      const { stdout, stderr } = await execAsync(sshCommand, {
        timeout: 300000, // 5分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB缓冲区
      })

      logs += `✅ 远程命令执行完成\n`
      logs += `📋 执行输出:\n${stdout}\n`

      if (stderr && stderr.trim()) {
        logs += `⚠️ 错误输出:\n${stderr}\n`
      }

      return {
        success: true,
        logs
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        logs: `SSH密钥认证执行失败: ${errorMessage}\n`,
        error: errorMessage
      }
    }
  }

  /**
   * 准备部署脚本
   */
  private prepareDeployScript(context: DeploymentExecutionContext): string {
    // 优先使用模板脚本，其次使用项目脚本
    let script = context.template?.deployScript || 
                 context.deployment.deployScript || 
                 context.deployment.project.deployScript || 
                 '# 默认部署脚本\necho "开始部署..."\necho "部署完成"'

    // 替换变量
    script = script
      .replace(/\$\{DEPLOYMENT_ID\}/g, context.deploymentId)
      .replace(/\$\{PROJECT_NAME\}/g, context.deployment.project.name)
      .replace(/\$\{BUILD_NUMBER\}/g, context.build?.buildNumber?.toString() || '')
      .replace(/\$\{ENVIRONMENT\}/g, context.deployment.environment)
      .replace(/\$\{VERSION\}/g, context.deployment.version || '')

    return script
  }

  /**
   * 准备主机特定脚本
   */
  private prepareHostScript(context: DeploymentExecutionContext, host: any, baseScript: string): string {
    let script = `#!/bin/bash
set -e

echo "=== 开始部署到主机: ${host.name} ==="
echo "主机地址: ${host.ip}"
echo "部署时间: $(date)"
echo "部署ID: ${context.deploymentId}"
echo "项目名称: ${context.deployment.project.name}"
echo "构建版本: ${context.build?.buildNumber || 'N/A'}"
echo ""

${baseScript}

echo ""
echo "=== 部署完成 ==="
echo "完成时间: $(date)"
`

    return script
  }

  /**
   * 创建工作目录
   */
  private async createWorkDirectory(deploymentId: string): Promise<string> {
    const workDir = path.join(process.cwd(), 'temp', 'deployments', deploymentId)
    await fs.mkdir(workDir, { recursive: true })
    return workDir
  }

  /**
   * 清理工作目录
   */
  private async cleanupWorkDirectory(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('⚠️ 清理工作目录失败:', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 更新部署状态
   */
  private async updateDeploymentStatus(
    deploymentId: string, 
    status: string, 
    message: string, 
    result?: DeploymentResult
  ): Promise<void> {
    try {
      const prisma = await this.getPrisma()

      const updateData: any = {
        status,
        updatedAt: new Date()
      }

      if (status === 'deploying') {
        updateData.startedAt = new Date()
      } else if (status === 'success' || status === 'failed') {
        updateData.completedAt = new Date()
        if (result) {
          updateData.duration = result.duration
          updateData.logs = result.logs
        }
      }

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: updateData
      })

      console.log(`📊 部署状态已更新: ${deploymentId} -> ${status}`)

    } catch (error) {
      console.error('❌ 更新部署状态失败:', error)
    }
  }

  /**
   * 发送部署通知
   */
  private async sendDeploymentNotification(
    context: DeploymentExecutionContext, 
    status: string
  ): Promise<void> {
    try {
      // 发送给申请人
      await notificationService.createDeploymentStatusNotification(
        context.deploymentId,
        context.deployment.name,
        context.deployment.project.name,
        status,
        context.deployment.environment,
        [context.deployment.user.id],
        context.deployment.user.id
      )

      // 发送给通知人员
      if (context.deployment.notificationUsers && Array.isArray(context.deployment.notificationUsers)) {
        const notificationUserIds = context.deployment.notificationUsers as string[]
        if (notificationUserIds.length > 0) {
          await notificationService.createDeploymentStatusNotification(
            context.deploymentId,
            context.deployment.name,
            context.deployment.project.name,
            status,
            context.deployment.environment,
            notificationUserIds,
            context.deployment.user.id
          )
        }
      }

    } catch (error) {
      console.error('❌ 发送部署通知失败:', error)
    }
  }

  /**
   * 执行Jenkins部署任务
   */
  private async executeJenkinsDeployment(context: DeploymentExecutionContext): Promise<{
    success: boolean
    logs: string
    error?: string
  }> {
    let logs = ''

    try {
      logs += `🚀 开始执行Jenkins部署任务\n`
      logs += `📋 任务名称: ${context.deployment.name}\n`
      logs += `🏷️ 环境: ${context.deployment.environment}\n`

      // 获取Jenkins任务ID列表
      const jenkinsJobIds = context.deployment.jenkinsJobIds || []
      if (!jenkinsJobIds || jenkinsJobIds.length === 0) {
        const error = 'Jenkins任务ID列表为空'
        logs += `❌ ${error}\n`
        return { success: false, logs, error }
      }

      logs += `🔧 Jenkins任务数量: ${jenkinsJobIds.length}\n`

      // 获取Jenkins配置（假设使用第一个可用的Jenkins配置）
      const prisma = await getPrismaClient()
      const jenkinsConfigs = await prisma.jenkinsConfig.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          serverUrl: true,
          username: true,
          apiToken: true
        },
        orderBy: { createdAt: 'asc' }
      })

      if (jenkinsConfigs.length === 0) {
        const error = '没有可用的Jenkins配置'
        logs += `❌ ${error}\n`
        return { success: false, logs, error }
      }

      const jenkinsConfig = jenkinsConfigs[0]
      logs += `🔗 使用Jenkins服务器: ${jenkinsConfig.name} (${jenkinsConfig.serverUrl})\n`
      logs += `👤 认证用户: ${jenkinsConfig.username || '未设置'}\n`

      // 检查认证信息
      if (!jenkinsConfig.username || !jenkinsConfig.apiToken) {
        const error = `Jenkins认证信息不完整: 用户名=${jenkinsConfig.username || '未设置'}, Token=${jenkinsConfig.apiToken ? '已设置' : '未设置'}`
        logs += `❌ ${error}\n`
        return { success: false, logs, error }
      }

      // 创建Jenkins客户端 - 使用正确的认证格式
      const authToken = `${jenkinsConfig.username}:${jenkinsConfig.apiToken}`
      const client = createJenkinsClient({
        jobUrl: jenkinsConfig.serverUrl,
        authToken: authToken
      })

      console.log(`🔐 [Jenkins执行] 认证信息: ${jenkinsConfig.username}:***`)

      // 获取可用的Jenkins任务列表
      const availableJobs = await client.getJobs()
      const availableJobNames = availableJobs.map(job => job.name)
      logs += `📋 可用Jenkins任务: ${availableJobNames.join(', ')}\n`

      // jenkinsJobIds现在直接存储Jenkins任务名称
      const jobsToExecute = []
      for (const jobName of jenkinsJobIds) {
        logs += `🔍 检查Jenkins任务: ${jobName}\n`

        // 验证任务是否在Jenkins服务器上存在
        if (availableJobNames.includes(jobName)) {
          jobsToExecute.push(jobName)
          logs += `✅ 找到Jenkins任务: ${jobName}\n`
        } else {
          logs += `⚠️ Jenkins任务不存在于服务器: ${jobName}\n`
          logs += `📋 可用任务列表: ${availableJobNames.join(', ')}\n`
        }
      }

      if (jobsToExecute.length === 0) {
        const error = '没有找到可执行的Jenkins任务'
        logs += `❌ ${error}\n`
        return { success: false, logs, error }
      }

      // 准备执行参数
      const parameters = {
        DEPLOYMENT_ID: context.deploymentId,
        ENVIRONMENT: context.deployment.environment,
        VERSION: context.deployment.version || 'latest',
        BUILD_NUMBER: context.build?.buildNumber?.toString() || 'latest'
      }

      logs += `📝 执行参数: ${JSON.stringify(parameters)}\n`

      // 执行Jenkins任务
      logs += `🚀 开始执行Jenkins任务: ${jobsToExecute.join(', ')}\n`
      logs += `📝 执行参数: ${JSON.stringify(parameters)}\n`
      logs += `🔗 Jenkins服务器: ${jenkinsConfig.serverUrl}\n`
      logs += `👤 认证用户: ${jenkinsConfig.username || '未设置'}\n`

      console.log(`🚀 [部署执行] 开始执行Jenkins任务:`, {
        jobs: jobsToExecute,
        parameters,
        jenkinsServer: jenkinsConfig.serverUrl,
        username: jenkinsConfig.username
      })

      const executionResult = await client.buildJobs({
        jobs: jobsToExecute,
        parameters,
        executionOrder: [] // 顺序执行
      })

      console.log(`📊 [部署执行] Jenkins执行结果:`, executionResult)

      logs += `🎯 Jenkins任务执行结果:\n`
      if (executionResult.executions && executionResult.executions.length > 0) {
        for (const result of executionResult.executions) {
          logs += `  • ${result.jobName}: ${result.status === 'queued' ? '✅ 已加入队列' : '❌ 失败'}\n`
          if (result.queueId) {
            logs += `    队列ID: ${result.queueId}\n`
            logs += `    队列URL: ${result.queueUrl}\n`

            // 存储队列信息到数据库，用于后续日志获取
            try {
              await prisma.deployment.update({
                where: { id: context.deployment.id },
                data: {
                  jenkinsQueueId: result.queueId,
                  jenkinsQueueUrl: result.queueUrl,
                  updatedAt: new Date()
                }
              })
              console.log(`📝 [部署执行] 保存Jenkins队列信息: ${result.jobName} -> 队列ID: ${result.queueId}`)
            } catch (updateError) {
              console.error('❌ [部署执行] 保存Jenkins队列信息失败:', updateError)
            }
          }
        }
      } else {
        logs += `  ⚠️ 没有任务被执行\n`
      }

      // 检查是否所有任务都成功
      const allSuccess = executionResult.executions.every(result => result.status === 'queued')

      if (allSuccess) {
        logs += `🎉 所有Jenkins任务执行成功\n`
        return { success: true, logs }
      } else {
        const failedJobs = executionResult.executions
          .filter(result => result.status === 'failed')
          .map(result => result.jobName)
        const error = `部分Jenkins任务执行失败: ${failedJobs.join(', ')}`
        logs += `❌ ${error}\n`
        return { success: false, logs, error }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      logs += `❌ Jenkins部署执行异常: ${errorMessage}\n`
      console.error('❌ Jenkins部署执行异常:', error)
      return { success: false, logs, error: errorMessage }
    }
  }
}

// 导出单例实例
export const deploymentExecutionService = new DeploymentExecutionService()
