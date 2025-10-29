import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { createJenkinsClient } from '../../../../../../lib/jenkins/client'

// 获取Jenkins部署任务的实时日志
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const deploymentId = params.id

    const prisma = await getPrismaClient()

    // 查找部署任务
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: {
        id: true,
        name: true,
        status: true,
        isJenkinsDeployment: true,
        jenkinsJobIds: true,
        jenkinsJobName: true,
        jenkinsQueueId: true,
        jenkinsQueueUrl: true,
        jenkinsBuildNumber: true,
        logs: true,
        startedAt: true,
        completedAt: true,
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    })

    if (!deployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在'
      }, { status: 404 })
    }

    // 权限检查：只有管理员、任务创建者或有查看权限的用户可以查看日志
    const canView = user.role === 'admin' || 
                   deployment.user.id === user.id ||
                   (user.permissions && user.permissions.includes('cicd:read'))

    if (!canView) {
      return NextResponse.json({
        success: false,
        error: '没有权限查看此部署任务的日志'
      }, { status: 403 })
    }

    // 检查是否为Jenkins部署任务
    if (!deployment.isJenkinsDeployment) {
      return NextResponse.json({
        success: false,
        error: '此部署任务不是Jenkins部署任务'
      }, { status: 400 })
    }

    console.log(`📋 获取Jenkins部署日志: ${deploymentId}`)

    // 获取Jenkins任务ID列表
    const jenkinsJobIds = deployment.jenkinsJobIds as string[] || []
    if (jenkinsJobIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          deploymentId,
          deploymentName: deployment.name,
          status: deployment.status,
          jobLogs: [],
          progress: 0,
          message: 'Jenkins任务ID列表为空'
        }
      })
    }

    // 获取Jenkins配置
    const jenkinsConfigs = await prisma.jenkinsConfig.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        serverUrl: true,
        username: true,
        apiToken: true
      }
    })

    if (jenkinsConfigs.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有可用的Jenkins配置'
      }, { status: 500 })
    }

    const jenkinsConfig = jenkinsConfigs[0]
    console.log(`🔗 使用Jenkins服务器: ${jenkinsConfig.name}`)

    // 创建Jenkins客户端 - 确保传递正确的认证信息
    let authToken = undefined
    if (jenkinsConfig.username && jenkinsConfig.apiToken) {
      authToken = `${jenkinsConfig.username}:${jenkinsConfig.apiToken}`
      console.log(`🔐 使用用户名密码认证: ${jenkinsConfig.username}:***`)
    } else if (jenkinsConfig.apiToken) {
      authToken = jenkinsConfig.apiToken
      console.log(`🔐 使用API Token认证: ***`)
    } else {
      console.warn(`⚠️ Jenkins配置缺少认证信息: ${jenkinsConfig.name}`)
    }

    const client = createJenkinsClient({
      jobUrl: jenkinsConfig.serverUrl,
      authToken: authToken
    })

    // 获取每个Jenkins任务的日志
    const jobLogs = []
    let totalProgress = 0

    for (const jobName of jenkinsJobIds) {
      try {
        // 现在jenkinsJobIds直接存储的是Jenkins任务名称，不需要复杂的解析
        const actualJobName = jobName
        const jenkinsConfigToUse = jenkinsConfig

        console.log(`🔍 Jenkins任务: ${actualJobName}`)

        // 为每个任务创建对应的Jenkins客户端（如果配置不同）
        let taskClient = client
        if (jenkinsConfigToUse.id !== jenkinsConfig.id) {
          // 为不同的Jenkins配置创建新的客户端
          let taskAuthToken = undefined
          if (jenkinsConfigToUse.username && jenkinsConfigToUse.apiToken) {
            taskAuthToken = `${jenkinsConfigToUse.username}:${jenkinsConfigToUse.apiToken}`
            console.log(`🔐 为任务创建认证客户端: ${jenkinsConfigToUse.username}:***`)
          } else if (jenkinsConfigToUse.apiToken) {
            taskAuthToken = jenkinsConfigToUse.apiToken
            console.log(`🔐 为任务创建Token客户端: ***`)
          }

          taskClient = createJenkinsClient({
            jobUrl: jenkinsConfigToUse.serverUrl,
            authToken: taskAuthToken
          })
        }

        // 获取任务详情
        console.log(`🔍 正在获取Jenkins任务详情: ${actualJobName}`)
        console.log(`🔗 Jenkins服务器: ${jenkinsConfigToUse.serverUrl || jenkinsConfig.serverUrl}`)

        const job = await taskClient.getJob(actualJobName)
        
        let jobLog = {
          jobName: actualJobName,
          buildNumber: job.lastBuild?.number,
          status: 'pending' as 'pending' | 'running' | 'success' | 'failed' | 'aborted',
          logs: '',
          queueId: undefined as number | undefined,
          startTime: undefined as string | undefined,
          duration: undefined as number | undefined
        }

        // 确定要获取日志的构建号 - 优先使用当前构建
        let buildNumber = null

        // 1. 优先使用存储的构建号（当前构建）
        if (deployment.jenkinsBuildNumber) {
          buildNumber = deployment.jenkinsBuildNumber
          console.log(`🎯 使用存储的构建号: ${buildNumber}`)
        }
        // 2. 如果有队列ID，尝试获取对应的构建号
        else if (deployment.jenkinsQueueId) {
          try {
            console.log(`🔍 通过队列ID获取构建号: ${deployment.jenkinsQueueId}`)
            // 注意：这里需要实现getQueueItem方法
            // const queueItem = await taskClient.getQueueItem(deployment.jenkinsQueueId)
            // 暂时跳过队列查询，直接使用最后构建
          } catch (queueError) {
            console.warn(`⚠️ 获取队列信息失败: ${queueError instanceof Error ? queueError.message : String(queueError)}`)
          }
        }

        // 3. 如果还没有构建号，使用最后一次构建
        if (!buildNumber && job.lastBuild && job.lastBuild.number) {
          buildNumber = job.lastBuild.number
          console.log(`📋 使用最后构建号: ${buildNumber}`)
        }

        // 更新jobLog的构建号和队列信息
        jobLog.buildNumber = buildNumber || undefined
        jobLog.queueId = deployment.jenkinsQueueId || undefined

        // 获取构建日志
        if (buildNumber) {
          try {
            console.log(`📋 获取构建日志: ${actualJobName} #${buildNumber}`)
            const buildLogs = await taskClient.getBuildLog(actualJobName, buildNumber)
            jobLog.logs = buildLogs

            // 使用job.lastBuild的信息（如果是最后构建）
            if (job.lastBuild && job.lastBuild.number === buildNumber) {
              jobLog.duration = job.lastBuild.duration
              if (job.lastBuild.timestamp) {
                jobLog.startTime = new Date(job.lastBuild.timestamp).toISOString()
              }

              // 根据构建结果设置状态
              if (job.lastBuild.result) {
                switch (job.lastBuild.result.toLowerCase()) {
                  case 'success':
                    jobLog.status = 'success'
                    totalProgress += 100 / jenkinsJobIds.length
                    break
                  case 'failure':
                    jobLog.status = 'failed'
                    break
                  case 'aborted':
                    jobLog.status = 'aborted'
                    break
                  default:
                    jobLog.status = 'running'
                    totalProgress += 50 / jenkinsJobIds.length
                }
              } else {
                // 构建正在进行中
                jobLog.status = 'running'
                totalProgress += 50 / jenkinsJobIds.length
              }
            } else {
              // 不是最后构建，可能是历史构建或当前构建
              jobLog.status = 'success' // 假设历史构建已完成
              totalProgress += 100 / jenkinsJobIds.length
            }

            console.log(`✅ 成功获取构建日志: ${actualJobName} #${buildNumber}`)

          } catch (logError) {
            console.warn(`获取Jenkins任务日志失败 (${actualJobName}):`, logError)
            jobLog.logs = `获取日志失败: ${logError instanceof Error ? logError.message : '未知错误'}`
            jobLog.status = 'failed'
          }
        } else {
          jobLog.logs = '暂无构建记录或构建尚未开始'
          jobLog.status = 'pending'
        }

        jobLogs.push(jobLog)

      } catch (error) {
        console.error(`❌ 获取Jenkins任务详情失败 (${jobName}):`, error)

        // 提供更详细的错误信息
        let errorMessage = '未知错误'
        let actualJobName = jobName

        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error)
        } else if (typeof error === 'string') {
          errorMessage = error
        }

        // jobName现在就是实际的任务名称
        actualJobName = jobName

        console.error(`❌ 详细错误信息: ${errorMessage}`)

        jobLogs.push({
          jobName: actualJobName,
          buildNumber: undefined,
          status: 'failed' as const,
          logs: `获取Jenkins任务详情失败:\n任务名称: ${actualJobName}\n错误: ${errorMessage}\n\n可能的原因:\n1. Jenkins任务 "${actualJobName}" 不存在\n2. Jenkins服务器连接失败\n3. 认证配置错误\n4. 任务权限不足\n\n建议:\n1. 检查Jenkins服务器上是否存在任务 "${actualJobName}"\n2. 验证Jenkins服务器连接和认证\n3. 确认用户有访问该任务的权限`,
          queueId: undefined,
          startTime: undefined,
          duration: undefined
        })
      }
    }

    // 计算整体进度
    const progress = Math.min(Math.round(totalProgress), 100)

    console.log(`📊 Jenkins日志获取完成: ${jobLogs.length}个任务, 进度: ${progress}%`)

    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        deploymentName: deployment.name,
        status: deployment.status,
        jobLogs,
        progress,
        jenkinsJobIds,
        jenkinsJobName: deployment.jenkinsJobName,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt
      }
    })

  } catch (error) {
    console.error('❌ 获取Jenkins部署日志失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取Jenkins部署日志失败'
    }, { status: 500 })
  }
}
