import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { deploymentExecutionService } from '../../../../../../lib/services/deploymentExecutionService'

// 启动部署
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

    console.log(`🚀 启动部署: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 获取部署详情
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repositoryUrl: true,
            branch: true
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

    // 检查部署状态
    if (deployment.status === 'deploying') {
      return NextResponse.json({
        success: false,
        error: '部署任务正在运行中'
      }, { status: 400 })
    }

    if (deployment.status === 'success') {
      return NextResponse.json({
        success: false,
        error: '部署任务已完成'
      }, { status: 400 })
    }

    // 检查是否需要审批
    const hasApprovalUsers = deployment.approvalUsers && Array.isArray(deployment.approvalUsers) && deployment.approvalUsers.length > 0
    if (hasApprovalUsers && deployment.status !== 'approved') {
      return NextResponse.json({
        success: false,
        error: '部署任务需要审批后才能启动'
      }, { status: 400 })
    }

    console.log(`✅ 部署启动成功: ${deployment.name}`)

    // 异步执行部署，不阻塞响应
    console.log('🚀 开始异步执行部署...')

    // 立即返回响应，部署在后台执行
    const deploymentPromise = deploymentExecutionService.triggerDeployment(deploymentId)

    // 不等待部署完成，立即返回
    setImmediate(async () => {
      try {
        const success = await deploymentPromise
        console.log(`${success ? '✅' : '❌'} 自动部署执行${success ? '成功' : '失败'}: ${deploymentId}`)
      } catch (error) {
        console.error('❌ 自动部署执行异常:', error)
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        deploymentId,
        status: 'deploying',
        startedAt: new Date().toISOString(),
        message: '部署已开始执行'
      },
      message: '部署启动成功，正在后台执行'
    })

  } catch (error) {
    console.error('❌ 启动部署失败:', error)
    return NextResponse.json({
      success: false,
      error: '启动部署失败'
    }, { status: 500 })
  }
}
