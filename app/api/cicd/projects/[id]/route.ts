import { NextRequest } from 'next/server'
import { 
  successResponse, 
  errorResponse, 
  serverErrorResponse,
  requirePermission,
  ensureDbInitialized
} from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

// 获取项目详情
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

    const projectId = params.id

    console.log('🔍 获取项目详情:', { projectId })

    // 查询项目数据
    const prisma = await getPrismaClient()
    const project = await prisma.cICDProject.findUnique({
      where: { id: projectId },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        },
        deployments: {
          select: { id: true, name: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    if (!project) {
      return errorResponse('项目不存在', undefined, 404)
    }

    console.log('✅ 项目详情获取成功:', { projectId, name: project.name })

    return successResponse({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        repositoryUrl: project.repositoryUrl,
        branch: project.branch,
        userId: project.userId,
        isActive: project.isActive,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        user: project.user,
        recentDeployments: project.deployments
      }
    })

  } catch (error) {
    console.error('❌ 获取项目详情错误:', error)
    return serverErrorResponse(error)
  }
}

// 更新项目
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    const projectId = params.id
    const updateData = await request.json()

    console.log('🔨 更新项目:', { projectId, updateData })

    // 检查项目是否存在
    const prisma = await getPrismaClient()
    const existingProject = await prisma.cICDProject.findUnique({
      where: { id: projectId }
    })

    if (!existingProject) {
      return errorResponse('项目不存在', undefined, 404)
    }

    // 权限检查：只有项目所有者可以更新项目
    if (existingProject.userId !== authResult.user.id) {
      return errorResponse('您没有权限更新此项目', undefined, 403)
    }

    // 构建更新数据 - 包含所有可更新字段
    const updatePayload: any = {}
    if (updateData.name !== undefined) updatePayload.name = updateData.name
    if (updateData.description !== undefined) updatePayload.description = updateData.description
    if (updateData.repositoryUrl !== undefined) updatePayload.repositoryUrl = updateData.repositoryUrl
    if (updateData.branch !== undefined) updatePayload.branch = updateData.branch
    if (updateData.buildScript !== undefined) updatePayload.buildScript = updateData.buildScript
    if (updateData.environment !== undefined) updatePayload.environment = updateData.environment
    if (updateData.buildTriggers !== undefined) updatePayload.buildTriggers = updateData.buildTriggers
    if (updateData.buildTimeout !== undefined) updatePayload.buildTimeout = updateData.buildTimeout
    if (updateData.tags !== undefined) updatePayload.tags = updateData.tags
    if (updateData.environmentVariables !== undefined) updatePayload.environmentVariables = updateData.environmentVariables
    if (updateData.notificationUsers !== undefined) updatePayload.notificationUsers = updateData.notificationUsers
    if (updateData.requireApproval !== undefined) updatePayload.requireApproval = updateData.requireApproval
    if (updateData.approvalUsers !== undefined) updatePayload.approvalUsers = updateData.approvalUsers
    if (updateData.isActive !== undefined) updatePayload.isActive = updateData.isActive

    // 更新项目
    const updatedProject = await prisma.cICDProject.update({
      where: { id: projectId },
      data: updatePayload,
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    console.log('✅ 项目更新成功:', { projectId, name: updatedProject.name })

    return successResponse({
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        description: updatedProject.description,
        repositoryUrl: updatedProject.repositoryUrl,
        repositoryType: updatedProject.repositoryType,
        branch: updatedProject.branch,
        buildScript: updatedProject.buildScript,
        environment: updatedProject.environment,
        buildTriggers: updatedProject.buildTriggers,
        buildTimeout: updatedProject.buildTimeout,
        tags: updatedProject.tags,
        environmentVariables: updatedProject.environmentVariables,
        notificationUsers: updatedProject.notificationUsers,
        requireApproval: updatedProject.requireApproval,
        approvalUsers: updatedProject.approvalUsers,
        userId: updatedProject.userId,
        isActive: updatedProject.isActive,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        user: updatedProject.user
      }
    })

  } catch (error) {
    console.error('❌ 更新项目错误:', error)
    return serverErrorResponse(error)
  }
}

// 删除项目
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    const projectId = params.id

    console.log('🗑️ 删除项目:', { projectId })

    // 检查项目是否存在
    const prisma = await getPrismaClient()
    const existingProject = await prisma.cICDProject.findUnique({
      where: { id: projectId }
    })

    if (!existingProject) {
      return errorResponse('项目不存在', undefined, 404)
    }

    // 权限检查：只有项目所有者可以删除项目
    if (existingProject.userId !== authResult.user.id) {
      return errorResponse('您没有权限删除此项目', undefined, 403)
    }

    // 删除项目
    await prisma.cICDProject.delete({
      where: { id: projectId }
    })

    console.log('✅ 项目删除成功:', { projectId })

    return successResponse({
      message: '项目删除成功'
    })

  } catch (error) {
    console.error('❌ 删除项目错误:', error)
    return serverErrorResponse(error)
  }
}
