import { NextRequest } from 'next/server'
import {
  validateRequest,
  successResponse,
  errorResponse,
  serverErrorResponse,
  requirePermission,
  ensureDbInitialized
} from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'

// 任务分组验证schema
const jobGroupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空').max(100, '分组名称不能超过100个字符'),
  description: z.string().optional(),
  jenkinsConfigId: z.string().min(1, 'Jenkins配置ID不能为空'),
  jobNames: z.array(z.string()).min(1, '至少需要选择一个任务'),
  id: z.string().optional()
})

// 获取任务分组列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:read')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    const { searchParams } = new URL(request.url)
    const jenkinsConfigId = searchParams.get('jenkinsConfigId')

    if (!jenkinsConfigId) {
      return errorResponse('缺少Jenkins配置ID', undefined, 400)
    }

    console.log('📋 获取任务分组列表:', { jenkinsConfigId })

    const prisma = await getPrismaClient()

    // 获取任务分组
    const groups = await prisma.jenkinsJobGroup.findMany({
      where: {
        jenkinsConfigId: jenkinsConfigId
      },
      include: {
        jobMappings: {
          select: {
            id: true,
            jobName: true,
            sortOrder: true,
            isActive: true
          },
          where: {
            isActive: true
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`✅ 成功获取 ${groups.length} 个任务分组`)

    return successResponse({
      groups: groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        jenkinsConfigId: group.jenkinsConfigId,
        jobs: group.jobMappings.map(mapping => ({
          id: mapping.id,
          jobName: mapping.jobName,
          displayName: mapping.jobName,
          sortOrder: mapping.sortOrder
        })),
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      })),
      total: groups.length
    })

  } catch (error) {
    console.error('❌ 获取任务分组列表错误:', error)
    return serverErrorResponse(error)
  }
}

// 创建任务分组
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    // 验证请求数据
    const validationResult = await validateRequest(request, jobGroupSchema)
    if (!validationResult.success) {
      return validationResult.response
    }

    const { name, description, jenkinsConfigId, jobNames } = validationResult.data

    console.log('📝 创建任务分组:', { name, jenkinsConfigId, jobNames })

    const prisma = await getPrismaClient()

    // 检查Jenkins配置是否存在
    const jenkinsConfig = await prisma.jenkinsConfig.findUnique({
      where: { id: jenkinsConfigId }
    })

    if (!jenkinsConfig) {
      return errorResponse('Jenkins配置不存在', undefined, 404)
    }

    // 检查分组名称是否重复
    const existingGroup = await prisma.jenkinsJobGroup.findFirst({
      where: {
        name: name,
        jenkinsConfigId: jenkinsConfigId
      }
    })

    if (existingGroup) {
      return errorResponse('分组名称已存在', '请使用不同的分组名称', 400)
    }

    // 创建任务分组
    const newGroup = await prisma.jenkinsJobGroup.create({
      data: {
        name,
        description: description || '',
        jenkinsConfigId,
        userId: authResult.user.id,
        jobMappings: {
          create: jobNames.map((jobName, index) => ({
            jobName,
            sortOrder: index,
            isActive: true
          }))
        }
      },
      include: {
        jobMappings: {
          select: {
            id: true,
            jobName: true,
            sortOrder: true,
            isActive: true
          }
        }
      }
    })

    console.log('✅ 任务分组创建成功:', newGroup.id)

    return successResponse({
      group: newGroup,
      message: '任务分组创建成功'
    })

  } catch (error) {
    console.error('❌ 创建任务分组错误:', error)
    return serverErrorResponse(error)
  }
}

// 更新任务分组
export async function PUT(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    // 验证请求数据
    const validationResult = await validateRequest(request, jobGroupSchema)
    if (!validationResult.success) {
      return validationResult.response
    }

    const { id, name, description, jenkinsConfigId, jobNames } = validationResult.data

    if (!id) {
      return errorResponse('缺少分组ID', undefined, 400)
    }

    console.log('📝 更新任务分组:', { id, name, jenkinsConfigId, jobNames })

    const prisma = await getPrismaClient()

    // 检查分组是否存在
    const existingGroup = await prisma.jenkinsJobGroup.findUnique({
      where: { id }
    })

    if (!existingGroup) {
      return errorResponse('任务分组不存在', undefined, 404)
    }

    // 检查名称是否与其他分组重复
    const duplicateGroup = await prisma.jenkinsJobGroup.findFirst({
      where: {
        name: name,
        jenkinsConfigId: jenkinsConfigId,
        id: { not: id }
      }
    })

    if (duplicateGroup) {
      return errorResponse('分组名称已存在', '请使用不同的分组名称', 400)
    }

    // 更新任务分组
    const updatedGroup = await prisma.$transaction(async (tx) => {
      // 删除现有的任务映射
      await tx.jenkinsJobGroupMapping.deleteMany({
        where: { groupId: id }
      })

      // 更新分组信息并创建新的任务映射
      return await tx.jenkinsJobGroup.update({
        where: { id },
        data: {
          name,
          description: description || '',
          jobMappings: {
            create: jobNames.map((jobName, index) => ({
              jobName,
              sortOrder: index,
              isActive: true
            }))
          }
        },
        include: {
          jobMappings: {
            select: {
              id: true,
              jobName: true,
              sortOrder: true,
              isActive: true
            }
          }
        }
      })
    })

    console.log('✅ 任务分组更新成功:', updatedGroup.id)

    return successResponse({
      group: updatedGroup,
      message: '任务分组更新成功'
    })

  } catch (error) {
    console.error('❌ 更新任务分组错误:', error)
    return serverErrorResponse(error)
  }
}

// 删除任务分组
export async function DELETE(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requirePermission(request, 'cicd:write')
    if (!authResult.success) {
      return authResult.response
    }

    // 确保数据库已初始化
    await ensureDbInitialized()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return errorResponse('缺少分组ID', undefined, 400)
    }

    console.log('🗑️ 删除任务分组:', { id })

    const prisma = await getPrismaClient()

    // 检查分组是否存在
    const existingGroup = await prisma.jenkinsJobGroup.findUnique({
      where: { id }
    })

    if (!existingGroup) {
      return errorResponse('任务分组不存在', undefined, 404)
    }

    // 删除任务分组（级联删除相关任务）
    await prisma.jenkinsJobGroup.delete({
      where: { id }
    })

    console.log('✅ 任务分组删除成功:', id)

    return successResponse({
      message: '任务分组删除成功'
    })

  } catch (error) {
    console.error('❌ 删除任务分组错误:', error)
    return serverErrorResponse(error)
  }
}
