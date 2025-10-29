import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'

// 获取部署详情
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

    const deploymentId = params.id

    console.log(`📋 获取部署详情: ${deploymentId}`)

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
        },
        user: {
          select: {
            id: true,
            username: true,
            realName: true
          }
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                username: true,
                realName: true
              }
            }
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

    console.log(`✅ 获取部署详情成功: ${deployment.name}`)

    return NextResponse.json({
      success: true,
      data: {
        deployment
      }
    })

  } catch (error) {
    console.error('❌ 获取部署详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取部署详情失败'
    }, { status: 500 })
  }
}

// 更新部署任务
export async function PUT(
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
    const body = await request.json()

    console.log(`📝 更新部署任务: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 检查部署是否存在且属于当前用户
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        userId: user.id
      }
    })

    if (!existingDeployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在或无权限修改'
      }, { status: 404 })
    }

    // 更新部署任务
    const updatedDeployment = await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        name: body.name,
        description: body.description,
        environment: body.environment,
        version: body.version,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        deploymentHosts: body.deploymentHosts || [],
        notificationUsers: body.notificationUsers || [],
        approvalUsers: body.approvalUsers || [],
        updatedAt: new Date()
      }
    })

    console.log(`✅ 部署任务更新成功: ${updatedDeployment.name}`)

    return NextResponse.json({
      success: true,
      data: {
        deployment: updatedDeployment
      },
      message: '部署任务更新成功'
    })

  } catch (error) {
    console.error('❌ 更新部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新部署任务失败'
    }, { status: 500 })
  }
}

// 删除部署任务
export async function DELETE(
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

    console.log(`🗑️ 删除部署任务: ${deploymentId}`)

    const prisma = await getPrismaClient()

    // 检查部署是否存在且属于当前用户
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        userId: user.id
      }
    })

    if (!existingDeployment) {
      return NextResponse.json({
        success: false,
        error: '部署任务不存在或无权限删除'
      }, { status: 404 })
    }

    // 检查部署状态
    if (existingDeployment.status === 'deploying') {
      return NextResponse.json({
        success: false,
        error: '正在部署的任务不能删除'
      }, { status: 400 })
    }

    // 删除部署任务（级联删除相关记录）
    await prisma.deployment.delete({
      where: { id: deploymentId }
    })

    console.log(`✅ 部署任务删除成功: ${existingDeployment.name}`)

    return NextResponse.json({
      success: true,
      message: '部署任务删除成功'
    })

  } catch (error) {
    console.error('❌ 删除部署任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除部署任务失败'
    }, { status: 500 })
  }
}
