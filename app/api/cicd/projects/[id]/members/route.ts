import { NextRequest } from 'next/server'
import { 
  validateRequest, 
  successResponse, 
  errorResponse, 
  serverErrorResponse,
  requirePermission,
  ensureDbInitialized,
  db
} from '../../../../../../lib/auth/apiHelpers'
import { AddProjectMemberRequest, RemoveProjectMemberRequest } from '../../../../../types/project'
import { z } from 'zod'

// 添加成员验证schema
const addMemberSchema = z.object({
  userIds: z.array(z.string().min(1, '用户ID不能为空')).min(1, '至少需要添加一个用户')
})

// 移除成员验证schema
const removeMemberSchema = z.object({
  userIds: z.array(z.string().min(1, '用户ID不能为空')).min(1, '至少需要移除一个用户')
})

// 获取项目成员列表
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

    console.log('👥 获取项目成员列表:', { projectId })

    // 检查项目是否存在
    const project = await db.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { 
            id: true, 
            username: true, 
            email: true, 
            role: true,
            isActive: true,
            createdAt: true
          }
        },
        assignees: {
          select: { 
            id: true, 
            username: true, 
            email: true, 
            role: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    })

    if (!project) {
      return errorResponse('项目不存在', undefined, 404)
    }

    // 组合成员列表（包含所有者和分配的成员）
    const members = [
      {
        ...project.owner,
        isOwner: true,
        addedAt: project.createdAt
      },
      ...project.assignees.map((assignee: any) => ({
        ...assignee,
        isOwner: false,
        addedAt: project.createdAt // 这里可以从关联表获取实际添加时间，目前使用项目创建时间
      }))
    ]

    // 去重（避免所有者也在分配列表中）
    const uniqueMembers = members.filter((member, index, self) => 
      index === self.findIndex(m => m.id === member.id)
    )

    console.log('✅ 项目成员列表获取成功:', { projectId, memberCount: uniqueMembers.length })

    return successResponse({
      members: uniqueMembers,
      total: uniqueMembers.length
    })

  } catch (error) {
    console.error('❌ 获取项目成员列表错误:', error)
    return serverErrorResponse(error)
  }
}

// 添加项目成员
export async function POST(
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

    // 验证请求数据
    const validationResult = await validateRequest<AddProjectMemberRequest>(request, addMemberSchema)
    if (!validationResult.success) {
      return validationResult.response
    }

    const projectId = params.id
    const { userIds } = validationResult.data

    console.log('➕ 添加项目成员:', { projectId, userIds })

    // 检查项目是否存在
    const existingProject = await db.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        assignees: { select: { id: true } }
      }
    })

    if (!existingProject) {
      return errorResponse('项目不存在', undefined, 404)
    }

    // 检查权限：只有项目所有者或管理员可以添加成员
    if (existingProject.userId !== authResult.user.id && !authResult.user.permissions.includes('*')) {
      return errorResponse('权限不足', undefined, 403)
    }

    // 验证要添加的用户是否存在
    const users = await db.prisma.user.findMany({
      where: { 
        id: { in: userIds },
        isActive: true
      },
      select: { id: true, username: true, email: true }
    })

    if (users.length !== userIds.length) {
      return errorResponse('部分用户不存在或已被禁用', undefined, 400)
    }

    // 过滤掉已经是成员的用户
    const existingMemberIds = existingProject.assignees.map((member: any) => member.id)
    const newMemberIds = userIds.filter(userId =>
      userId !== existingProject.userId && // 排除所有者
      !existingMemberIds.includes(userId) // 排除已存在的成员
    )

    if (newMemberIds.length === 0) {
      return errorResponse('指定的用户已经是项目成员', undefined, 400)
    }

    // 添加新成员
    await db.prisma.project.update({
      where: { id: projectId },
      data: {
        assignees: {
          connect: newMemberIds.map(id => ({ id }))
        },
        assigneeIds: {
          push: newMemberIds
        }
      }
    })

    console.log('✅ 项目成员添加成功:', { projectId, addedCount: newMemberIds.length })

    return successResponse({
      message: `成功添加 ${newMemberIds.length} 个成员`,
      addedMembers: users.filter((user: any) => newMemberIds.includes(user.id))
    })

  } catch (error) {
    console.error('❌ 添加项目成员错误:', error)
    return serverErrorResponse(error)
  }
}

// 移除项目成员
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

    // 验证请求数据
    const validationResult = await validateRequest<RemoveProjectMemberRequest>(request, removeMemberSchema)
    if (!validationResult.success) {
      return validationResult.response
    }

    const projectId = params.id
    const { userIds } = validationResult.data

    console.log('➖ 移除项目成员:', { projectId, userIds })

    // 检查项目是否存在
    const existingProject = await db.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        assignees: { select: { id: true } }
      }
    })

    if (!existingProject) {
      return errorResponse('项目不存在', undefined, 404)
    }

    // 检查权限：只有项目所有者或管理员可以移除成员
    if (existingProject.ownerId !== authResult.user.id && !authResult.user.permissions.includes('*')) {
      return errorResponse('权限不足', undefined, 403)
    }

    // 不能移除项目所有者
    if (userIds.includes(existingProject.ownerId)) {
      return errorResponse('不能移除项目所有者', undefined, 400)
    }

    // 过滤出实际存在的成员
    const existingMemberIds = existingProject.assignees.map((member: any) => member.id)
    const validRemoveIds = userIds.filter(userId => existingMemberIds.includes(userId))

    if (validRemoveIds.length === 0) {
      return errorResponse('指定的用户不是项目成员', undefined, 400)
    }

    // 移除成员
    await db.prisma.project.update({
      where: { id: projectId },
      data: {
        assignees: {
          disconnect: validRemoveIds.map(id => ({ id }))
        },
        assigneeIds: existingProject.assigneeIds.filter((id: any) => !validRemoveIds.includes(id))
      }
    })

    console.log('✅ 项目成员移除成功:', { projectId, removedCount: validRemoveIds.length })

    return successResponse({
      message: `成功移除 ${validRemoveIds.length} 个成员`,
      removedMemberIds: validRemoveIds
    })

  } catch (error) {
    console.error('❌ 移除项目成员错误:', error)
    return serverErrorResponse(error)
  }
}
