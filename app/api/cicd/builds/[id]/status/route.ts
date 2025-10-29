import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { JenkinsClient } from '../../../../../../lib/jenkins/client'

// 获取构建状态（支持实时更新）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const buildId = params.id
    const prisma = await getPrismaClient()

    // 获取构建信息
    const build = await prisma.build.findFirst({
      where: {
        id: buildId,
        userId: user.id
      },
      include: {
        pipeline: {
          include: {
            project: {
              select: { id: true, name: true }
            }
          }
        },
        jenkinsConfig: {
          select: {
            id: true,
            name: true,
            serverUrl: true,
            username: true,
            apiToken: true
          }
        }
      }
    })

    if (!build) {
      return NextResponse.json({
        success: false,
        error: '构建记录不存在或无权限访问'
      }, { status: 404 })
    }

    let jenkinsStatus = null
    let shouldUpdateDatabase = false
    let updatedBuild = { ...build }

    // 如果构建正在运行且有Jenkins配置，获取实时状态
    if (build.status === 'running' && build.jenkinsConfig && build.queueId) {
      try {
        console.log('🔍 查询Jenkins构建状态...', { buildId, queueId: build.queueId })
        
        const jenkinsClient = new JenkinsClient({
          baseUrl: build.jenkinsConfig.serverUrl,
          username: build.jenkinsConfig.username || undefined,
          token: build.jenkinsConfig.apiToken || undefined
        })

        // 先尝试获取队列信息
        try {
          const queueItem = await jenkinsClient.getQueueItem(parseInt(build.queueId))
          
          if (queueItem.executable) {
            // 构建已开始执行
            const buildNumber = queueItem.executable.number
            const buildInfo = await jenkinsClient.getBuild(build.jenkinsJobName, buildNumber)
            
            jenkinsStatus = {
              buildNumber,
              building: buildInfo.building,
              result: buildInfo.result,
              duration: buildInfo.duration,
              estimatedDuration: buildInfo.estimatedDuration,
              timestamp: buildInfo.timestamp,
              inQueue: false
            }

            // 如果构建完成，更新数据库状态
            if (!buildInfo.building && buildInfo.result) {
              const newStatus = buildInfo.result === 'SUCCESS' ? 'success' : 'failed'
              const completedAt = new Date(buildInfo.timestamp + (buildInfo.duration || 0))
              const duration = Math.floor((buildInfo.duration || 0) / 1000)

              updatedBuild = await prisma.build.update({
                where: { id: buildId },
                data: {
                  status: newStatus,
                  result: buildInfo.result,
                  completedAt,
                  duration
                }
              }) as any
              
              shouldUpdateDatabase = true
              console.log('✅ 构建状态已更新:', { buildId, status: newStatus, duration })
            }
          } else {
            // 仍在队列中
            jenkinsStatus = {
              queueId: build.queueId,
              building: false,
              result: null,
              inQueue: true,
              queueWhy: queueItem.why || '等待执行'
            }
          }
        } catch (queueError) {
          console.warn('获取Jenkins队列信息失败:', queueError)
          // 队列信息获取失败，可能构建已完成或队列ID无效
          // 尝试直接获取构建信息
          if ((build as any).jenkinsBuildNumber) {
            try {
              const buildInfo = await jenkinsClient.getBuild(build.jenkinsJobName, (build as any).jenkinsBuildNumber)
              jenkinsStatus = {
                buildNumber: (build as any).jenkinsBuildNumber,
                building: buildInfo.building,
                result: buildInfo.result,
                duration: buildInfo.duration,
                timestamp: buildInfo.timestamp,
                inQueue: false
              }
            } catch (buildError) {
              console.warn('获取Jenkins构建信息失败:', buildError)
            }
          }
        }
      } catch (error) {
        console.error('获取Jenkins状态失败:', error)
        jenkinsStatus = {
          error: '无法连接到Jenkins服务器'
        }
      }
    }

    // 计算执行进度
    let progress = 0
    if (updatedBuild.status === 'pending') {
      progress = 0
    } else if (updatedBuild.status === 'running') {
      if (jenkinsStatus?.estimatedDuration && jenkinsStatus?.duration) {
        progress = Math.min(95, (jenkinsStatus.duration / jenkinsStatus.estimatedDuration) * 100)
      } else {
        progress = 50 // 默认进度
      }
    } else if (['success', 'failed', 'aborted'].includes(updatedBuild.status)) {
      progress = 100
    }

    console.log('✅ 获取构建状态成功:', { buildId, status: updatedBuild.status, progress })

    return NextResponse.json({
      success: true,
      data: {
        build: {
          id: updatedBuild.id,
          buildNumber: updatedBuild.buildNumber,
          status: updatedBuild.status,
          result: updatedBuild.result,
          startedAt: updatedBuild.startedAt,
          completedAt: updatedBuild.completedAt,
          duration: updatedBuild.duration,
          queueId: updatedBuild.queueId,
          jenkinsBuildNumber: (updatedBuild as any).jenkinsBuildNumber || null
        },
        jenkinsStatus,
        progress,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 获取构建状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取构建状态失败'
    }, { status: 500 })
  }
}
