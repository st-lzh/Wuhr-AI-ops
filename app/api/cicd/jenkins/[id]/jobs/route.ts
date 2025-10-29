import { NextRequest } from 'next/server'
import {
  validateRequest,
  successResponse,
  errorResponse,
  serverErrorResponse,
  requirePermission,
  ensureDbInitialized
} from '../../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { createJenkinsClient } from '../../../../../../lib/jenkins/client'
import { JenkinsJobExecuteRequest } from '../../../../../../lib/jenkins/types'
import { z } from 'zod'

// 执行作业验证schema
const executeJobsSchema = z.object({
  jobs: z.array(z.string().min(1, '作业名称不能为空')).min(1, '至少需要选择一个作业'),
  parameters: z.record(z.any()).optional(),
  executionOrder: z.array(z.number()).optional()
})

// 获取Jenkins作业列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:read')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    const configId = params.id

    console.log('📋 获取Jenkins作业列表:', { configId })

    // 获取Jenkins配置
    const prisma = await getPrismaClient()
    const jenkinsConfig = await prisma.jenkinsConfig.findUnique({
      where: { id: configId }
    })

    if (!jenkinsConfig) {
      return errorResponse('Jenkins配置不存在', undefined, 404)
    }

    if (!jenkinsConfig.isActive) {
      return errorResponse('Jenkins配置已禁用', undefined, 400)
    }

    try {
      console.log('🔐 Jenkins配置信息:', {
        serverUrl: jenkinsConfig.serverUrl,
        hasUsername: !!jenkinsConfig.username,
        hasApiToken: !!jenkinsConfig.apiToken,
        username: jenkinsConfig.username ? `${jenkinsConfig.username.substring(0, 3)}***` : 'none',
        apiTokenFormat: jenkinsConfig.apiToken ? `${jenkinsConfig.apiToken.substring(0, 8)}...` : 'none',
        apiTokenHasColon: jenkinsConfig.apiToken ? jenkinsConfig.apiToken.includes(':') : false
      })

      // 解析认证信息（兼容两种格式）
      let authUsername = ''
      let authToken = ''

      if (jenkinsConfig.apiToken && jenkinsConfig.apiToken.includes(':')) {
        // 格式1: apiToken包含 "username:token"
        const parts = jenkinsConfig.apiToken.split(':')
        authUsername = parts[0]
        authToken = parts[1]
        console.log('🔑 认证信息解析 (格式1 - 完整):', {
          parsedUsername: authUsername ? `${authUsername.substring(0, 3)}***` : 'none',
          parsedTokenLength: authToken ? authToken.length : 0
        })
      } else if (jenkinsConfig.username && jenkinsConfig.apiToken) {
        // 格式2: username和apiToken分开存储
        authUsername = jenkinsConfig.username
        authToken = jenkinsConfig.apiToken
        console.log('🔑 认证信息解析 (格式2 - 分开):', {
          username: authUsername ? `${authUsername.substring(0, 3)}***` : 'none',
          tokenLength: authToken ? authToken.length : 0
        })
      } else {
        console.log('❌ 认证信息不完整')
        return errorResponse(
          'Jenkins配置不完整',
          '请配置用户名和API Token',
          400
        )
      }

      const base64Auth = Buffer.from(`${authUsername}:${authToken}`).toString('base64')
      console.log('🔑 最终认证信息:', {
        authString: `${authUsername}:${authToken.substring(0, 4)}***`,
        base64Preview: base64Auth.substring(0, 12) + '...'
      })

      // 检查认证信息
      if (!jenkinsConfig.username || !jenkinsConfig.apiToken) {
        console.warn('⚠️ Jenkins配置缺少认证信息')
        return errorResponse(
          'Jenkins配置不完整',
          '请配置用户名和API Token以访问Jenkins服务器',
          400
        )
      }

      // 创建Jenkins客户端
      const jenkinsClient = createJenkinsClient({
        jobUrl: jenkinsConfig.serverUrl,
        authToken: jenkinsConfig.apiToken || undefined
      })

      console.log('📋 从Jenkins服务器获取作业列表...')

      // 先进行直接的HTTP测试
      console.log('🧪 直接HTTP测试...')
      const testUrl = `${jenkinsConfig.serverUrl}/api/json`

      try {
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${base64Auth}`,
            'Accept': 'application/json',
            'User-Agent': 'Wuhr-AI-Ops/1.0'
          },
          signal: AbortSignal.timeout(10000)
        })

        console.log('🧪 直接HTTP测试结果:', {
          status: testResponse.status,
          statusText: testResponse.statusText,
          headers: Object.fromEntries(testResponse.headers.entries())
        })

        if (!testResponse.ok) {
          const errorText = await testResponse.text()
          console.log('🧪 HTTP错误响应:', errorText.substring(0, 500))

          return errorResponse(
            'Jenkins认证失败',
            `HTTP ${testResponse.status}: ${testResponse.statusText}. 请检查API Token是否有效。`,
            503
          )
        }

        const testData = await testResponse.json()
        console.log('🧪 HTTP测试成功:', {
          version: testData.version,
          jobCount: testData.jobs ? testData.jobs.length : 0
        })

      } catch (httpError: any) {
        console.error('🧪 直接HTTP测试失败:', httpError)
        return errorResponse(
          'Jenkins连接失败',
          `网络连接错误: ${httpError.message}`,
          503
        )
      }

      // 由于Jenkins客户端库有问题，直接使用HTTP调用获取作业列表
      console.log('🔄 使用直接HTTP调用获取Jenkins作业列表...')

      const jobsResponse = await fetch(`${jenkinsConfig.serverUrl}/api/json?tree=jobs[name,displayName,description,url,buildable,color,lastBuild[number,url,timestamp,result,duration],nextBuildNumber,inQueue]`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${base64Auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Wuhr-AI-Ops/1.0'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!jobsResponse.ok) {
        console.error(`❌ HTTP获取作业列表失败: ${jobsResponse.status} ${jobsResponse.statusText}`)
        throw new Error(`HTTP ${jobsResponse.status}: ${jobsResponse.statusText}`)
      }

      const jobsData = await jobsResponse.json()
      const jobs = jobsData.jobs || []

      console.log(`✅ 成功获取 ${jobs.length} 个Jenkins作业`)

      return successResponse({
        jobs: jobs.map((job: any) => ({
          name: job.name,
          displayName: job.displayName || job.name,
          description: job.description || '',
          url: job.url,
          buildable: job.buildable !== false, // 默认为true
          color: job.color || 'notbuilt',
          lastBuild: job.lastBuild ? {
            number: job.lastBuild.number,
            url: job.lastBuild.url,
            timestamp: job.lastBuild.timestamp,
            result: job.lastBuild.result,
            duration: job.lastBuild.duration
          } : null,
          nextBuildNumber: job.nextBuildNumber,
          inQueue: job.inQueue || false
        })),
        total: jobs.length,
        jenkinsConfig: {
          id: jenkinsConfig.id,
          name: jenkinsConfig.name,
          serverUrl: jenkinsConfig.serverUrl
        }
      })

    } catch (jenkinsError: any) {
      console.error('❌ 连接Jenkins服务器失败:', jenkinsError)

      // 特殊处理403权限错误
      if (jenkinsError.statusCode === 403 || jenkinsError.message?.includes('Forbidden')) {
        return errorResponse(
          'Jenkins权限不足',
          `当前用户 "${jenkinsConfig.username}" 没有查看Jenkins作业列表的权限。

解决方案：
1. 确保用户具有 "Overall/Read" 权限
2. 确保用户具有 "Job/Read" 权限
3. 或者将用户添加到具有相应权限的用户组中

请联系Jenkins管理员配置相应权限。

技术详情：
- Jenkins服务器：${jenkinsConfig.serverUrl}
- 用户名：${jenkinsConfig.username}
- 错误代码：403 Forbidden`,
          403
        )
      }

      // 其他错误的通用处理
      return errorResponse(
        '无法连接到Jenkins服务器',
        `请检查Jenkins配置和网络连接: ${jenkinsError.message}`,
        503
      )
    }

  } catch (error) {
    console.error('❌ 获取Jenkins作业列表错误:', error)
    return serverErrorResponse(error)
  }
}

// 执行Jenkins作业（支持多选和顺序执行）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查 - 执行作业需要写权限
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    // 验证请求数据
    const validationResult = await validateRequest<JenkinsJobExecuteRequest>(request, executeJobsSchema)
    if (!validationResult.success) {
      return validationResult.response
    }

    const configId = params.id
    const { jobs, parameters, executionOrder } = validationResult.data

    console.log('🚀 执行Jenkins作业:', { configId, jobs, parameters, executionOrder })

    // 获取Prisma客户端
    const prisma = await getPrismaClient()

    // 获取Jenkins配置
    const jenkinsConfig = await prisma.jenkinsConfig.findUnique({
      where: { id: configId }
    })

    if (!jenkinsConfig) {
      return errorResponse('Jenkins配置不存在', undefined, 404)
    }

    if (!jenkinsConfig.isActive) {
      return errorResponse('Jenkins配置已禁用', undefined, 400)
    }

    // 创建Jenkins客户端
    const client = createJenkinsClient({
      jobUrl: jenkinsConfig.serverUrl, // 使用serverUrl作为jobUrl
      authToken: jenkinsConfig.apiToken || undefined
    })

    // 首先验证所有作业是否存在
    console.log('🔍 验证作业是否存在...')
    const availableJobs = await client.getJobs()
    const availableJobNames = availableJobs.map(job => job.name)
    
    const invalidJobs = jobs.filter(jobName => !availableJobNames.includes(jobName))
    if (invalidJobs.length > 0) {
      return errorResponse(
        `以下作业不存在: ${invalidJobs.join(', ')}`, 
        `可用作业: ${availableJobNames.join(', ')}`, 
        400
      )
    }

    // 执行作业
    const executionResult = await client.buildJobs({
      jobs,
      parameters,
      executionOrder
    })

    // 记录执行历史到数据库（可选）
    for (const execution of executionResult.executions) {
      if (execution.status === 'queued') {
        try {
          // 简化版本：记录到Build表
          await prisma.build.create({
            data: {
              jenkinsConfigId: jenkinsConfig.id,
              userId: authResult.user.id,
              jenkinsJobName: execution.jobName,
              buildNumber: parseInt(execution.queueId.toString()) || 0,
              status: 'pending',
              queueId: execution.queueId.toString(),
              logs: `队列URL: ${execution.queueUrl}`
            }
          })
        } catch (dbError) {
          console.error('记录部署历史失败:', dbError)
          // 不影响主流程，继续执行
        }
      }
    }

    console.log('✅ Jenkins作业执行完成:', { 
      configId, 
      totalJobs: jobs.length,
      successCount: executionResult.executions.filter(e => e.status === 'queued').length,
      failedCount: executionResult.executions.filter(e => e.status === 'failed').length
    })

    return successResponse({
      executionResult,
      jenkinsConfig: {
        id: jenkinsConfig.id,
        name: jenkinsConfig.name,
        serverUrl: jenkinsConfig.serverUrl
      },
      summary: {
        totalJobs: jobs.length,
        successCount: executionResult.executions.filter(e => e.status === 'queued').length,
        failedCount: executionResult.executions.filter(e => e.status === 'failed').length
      }
    })

  } catch (error) {
    console.error('❌ 执行Jenkins作业错误:', error)
    return serverErrorResponse(error)
  }
}
