import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { triggerApprovedDeployment } from '../../../../../../lib/services/deploymentTriggerService'
import { canWriteTeamAssets } from '../../../../../../lib/auth/teamAccess'

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
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有部署执行权限' }, { status: 403 })
    }
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

    const result = await triggerApprovedDeployment(deploymentId, user.id, prisma)

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.message,
      error: result.success ? undefined : result.message
    }, { status: result.success ? 200 : 409 })

  } catch (error) {
    console.error('❌ 启动部署失败:', error)
    return NextResponse.json({
      success: false,
      error: '启动部署失败'
    }, { status: 500 })
  }
}
