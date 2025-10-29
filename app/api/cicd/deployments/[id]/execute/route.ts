import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../../lib/config/database'

// 执行Jenkins部署任务
export async function POST(
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

    console.log(`🚀 开始执行Jenkins部署任务: ${deploymentId} by ${user.username}`)

    const prisma = await getPrismaClient()

    // 获取部署任务信息
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
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

    if (!deployment.isJenkinsDeployment) {
      return NextResponse.json({
        success: false,
        error: '这不是Jenkins部署任务'
      }, { status: 400 })
    }

    // 检查任务状态
    if (!['pending', 'approved'].includes(deployment.status)) {
      return NextResponse.json({
        success: false,
        error: `任务状态为 ${deployment.status}，无法执行`
      }, { status: 400 })
    }

    // 获取Jenkins配置
    const jenkinsConfig = await prisma.jenkinsConfig.findFirst({
      where: { isActive: true }
    })

    if (!jenkinsConfig) {
      return NextResponse.json({
        success: false,
        error: '没有找到激活的Jenkins配置'
      }, { status: 400 })
    }

    console.log('🔧 使用Jenkins配置:', {
      id: jenkinsConfig.id,
      name: jenkinsConfig.name,
      serverUrl: jenkinsConfig.serverUrl
    })

    // 更新任务状态为执行中
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: 'deploying',
        updatedAt: new Date()
      }
    })

    // 执行Jenkins任务
    const jenkinsJobIds = deployment.jenkinsJobIds as string[]
    if (!jenkinsJobIds || jenkinsJobIds.length === 0) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed' }
      })
      return NextResponse.json({
        success: false,
        error: '没有配置Jenkins任务'
      }, { status: 400 })
    }

    const results = []

    for (const jobId of jenkinsJobIds) {
      try {
        console.log(`🔄 执行Jenkins任务: ${jobId}`)

        // 构建认证信息
        const auth = Buffer.from(`${jenkinsConfig.username}:${jenkinsConfig.apiToken}`).toString('base64')

        // 调用Jenkins API执行任务
        const buildResponse = await fetch(`${jenkinsConfig.serverUrl}/job/${jobId}/build`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Wuhr-AI-Ops/1.0'
          },
          signal: AbortSignal.timeout(30000)
        })

        if (buildResponse.ok) {
          console.log(`✅ Jenkins任务 ${jobId} 触发成功`)

          // 获取队列信息
          const queueLocation = buildResponse.headers.get('Location')
          let queueId = null
          let queueUrl = null

          if (queueLocation) {
            const queueMatch = queueLocation.match(/\/queue\/item\/(\d+)\//)
            if (queueMatch) {
              queueId = parseInt(queueMatch[1])
              queueUrl = queueLocation
              console.log(`📋 Jenkins队列ID: ${queueId}`)
            }
          }

          // 更新部署任务的Jenkins队列信息
          if (queueId) {
            await prisma.deployment.update({
              where: { id: deploymentId },
              data: {
                jenkinsQueueId: queueId,
                jenkinsQueueUrl: queueUrl,
                updatedAt: new Date()
              }
            })
          }

          results.push({
            jobId,
            success: true,
            message: '任务触发成功',
            queueId,
            queueUrl
          })
        } else {
          console.error(`❌ Jenkins任务 ${jobId} 触发失败: ${buildResponse.status}`)
          const errorText = await buildResponse.text().catch(() => 'Unknown error')
          results.push({
            jobId,
            success: false,
            message: `触发失败: HTTP ${buildResponse.status} - ${errorText}`
          })
        }
      } catch (error: any) {
        console.error(`❌ Jenkins任务 ${jobId} 执行异常:`, error)
        results.push({
          jobId,
          success: false,
          message: `执行异常: ${error.message}`
        })
      }
    }

    // 判断整体执行结果
    const allSuccess = results.every(r => r.success)
    const finalStatus = allSuccess ? 'success' : 'failed'

    // 更新最终状态
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: finalStatus,
        updatedAt: new Date()
      }
    })

    console.log(`🎯 Jenkins部署任务执行完成，最终状态: ${finalStatus}`)

    return NextResponse.json({
      success: true,
      message: `Jenkins任务执行${allSuccess ? '成功' : '部分失败'}`,
      data: {
        deploymentId,
        finalStatus,
        results
      }
    })

  } catch (error) {
    console.error('❌ 执行Jenkins部署任务失败:', error)

    // 更新任务状态为失败
    try {
      const errorPrisma = await getPrismaClient()
      await errorPrisma.deployment.update({
        where: { id: params.id },
        data: {
          status: 'failed',
          updatedAt: new Date()
        }
      })
    } catch (updateError) {
      console.error('更新任务状态失败:', updateError)
    }

    return NextResponse.json({
      success: false,
      error: '执行Jenkins任务时发生错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}