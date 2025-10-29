import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'

// 获取部署状态和日志
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

    console.log(`📊 获取部署状态: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 查找部署任务
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            name: true
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
      return NextResponse.json({
        success: false,
        error: '部署任务不存在'
      }, { status: 404 })
    }

    // 权限检查：项目成员或管理员可以查看状态
    const canViewStatus = user.role === 'admin' || 
                         deployment.userId === user.id ||
                         (user.permissions && user.permissions.includes('cicd:read'))

    if (!canViewStatus) {
      return NextResponse.json({
        success: false,
        error: '没有权限查看部署状态'
      }, { status: 403 })
    }

    // 计算部署持续时间
    let duration = null
    if (deployment.startedAt) {
      const endTime = deployment.completedAt || new Date()
      duration = Math.floor((endTime.getTime() - deployment.startedAt.getTime()) / 1000)
    }

    // 获取日志内容
    const logs = deployment.logs || ''
    
    // 分析日志状态
    const logStats = analyzeLogStatus(logs)

    return NextResponse.json({
      success: true,
      data: {
        id: deployment.id,
        name: deployment.name,
        status: deployment.status,
        environment: deployment.environment,
        version: deployment.version,
        logs: logs,
        logStats,
        project: deployment.project,
        user: deployment.user,
        createdAt: deployment.createdAt,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
        updatedAt: deployment.updatedAt,
        duration,
        config: deployment.config,
        deploymentHosts: deployment.deploymentHosts,
        notificationUsers: deployment.notificationUsers,
        approvalUsers: deployment.approvalUsers,
        requireApproval: deployment.requireApproval
      }
    })

  } catch (error) {
    console.error('❌ 获取部署状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取部署状态失败'
    }, { status: 500 })
  }
}

// 分析日志状态
function analyzeLogStatus(logs: string) {
  const lines = logs.split('\n').filter(line => line.trim())
  
  const stats = {
    totalLines: lines.length,
    hasLogs: logs.length > 0,
    errorCount: 0,
    warningCount: 0,
    successCount: 0,
    lastLogTime: null as string | null,
    currentPhase: '未知',
    progress: 0
  }

  if (lines.length === 0) {
    return stats
  }

  // 分析日志内容
  lines.forEach(line => {
    const lowerLine = line.toLowerCase()
    
    // 错误计数
    if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('❌')) {
      stats.errorCount++
    }
    
    // 警告计数
    if (lowerLine.includes('warning') || lowerLine.includes('warn') || lowerLine.includes('⚠️')) {
      stats.warningCount++
    }
    
    // 成功计数
    if (lowerLine.includes('success') || lowerLine.includes('completed') || lowerLine.includes('✅')) {
      stats.successCount++
    }

    // 检测当前阶段
    if (line.includes('🚀 开始完整部署流程')) {
      stats.currentPhase = '初始化部署'
      stats.progress = 10
    } else if (line.includes('📥 开始拉取代码')) {
      stats.currentPhase = '代码拉取'
      stats.progress = 20
    } else if (line.includes('🔨 开始本地构建')) {
      stats.currentPhase = '本地构建'
      stats.progress = 40
    } else if (line.includes('🚀 开始部署到主机')) {
      stats.currentPhase = '主机部署'
      stats.progress = 60
    } else if (line.includes('✅ 部署完成')) {
      stats.currentPhase = '部署完成'
      stats.progress = 100
    } else if (line.includes('❌') && line.includes('失败')) {
      stats.currentPhase = '部署失败'
      stats.progress = 0
    }

    // 提取时间戳
    const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/)
    if (timestampMatch) {
      stats.lastLogTime = timestampMatch[1]
    }
  })

  return stats
}
