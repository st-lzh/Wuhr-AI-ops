import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'
import { canWriteTeamAssets } from '../../../../lib/auth/teamAccess'

// 部署模板验证schema
const DeploymentTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100, '模板名称过长'),
  description: z.string().optional(),
  type: z.enum(['kubernetes', 'docker', 'shell', 'ansible'], {
    errorMap: () => ({ message: '请选择有效的模板类型' })
  }),
  content: z.string().min(1, '模板内容不能为空'),
  version: z.string().min(1, '版本号不能为空'),
  isActive: z.boolean().default(true)
})

// 获取部署模板列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    console.log('📋 获取部署模板列表')

    const prisma = await getPrismaClient()
    const templates = await prisma.deploymentTemplate.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            deployments: true // 统计使用次数
          }
        }
      }
    })

    // 转换数据格式
    const templatesWithUsage = templates.map(template => ({
      ...template,
      usageCount: template._count.deployments,
      _count: undefined
    }))

    console.log('📋 找到部署模板:', templates.length, '个')

    return NextResponse.json({
      success: true,
      data: {
        templates: templatesWithUsage,
        total: templates.length
      }
    })
  } catch (error) {
    console.error('❌ [模板API] 获取模板列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取模板列表失败'
    }, { status: 500 })
  }
}

// 创建部署模板
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限创建部署模板' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // 验证输入数据
    const validationResult = DeploymentTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const templateData = validationResult.data

    console.log('📝 创建部署模板:', templateData.name)

    const prisma = await getPrismaClient()

    // 检查模板名称是否已存在
    const existingTemplate = await prisma.deploymentTemplate.findFirst({
      where: {
        name: templateData.name
      }
    })

    if (existingTemplate) {
      return NextResponse.json({
        success: false,
        error: '模板名称已存在'
      }, { status: 400 })
    }

    // 创建模板
    const newTemplate = await prisma.deploymentTemplate.create({
      data: {
        ...templateData,
        createdBy: user.id,
        usageCount: 0
      }
    })

    console.log('✅ 部署模板创建成功:', newTemplate.id)

    return NextResponse.json({
      success: true,
      data: {
        template: newTemplate
      }
    })
  } catch (error) {
    console.error('❌ [模板API] 创建模板失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建模板失败'
    }, { status: 500 })
  }
}

// 更新部署模板
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限修改部署模板' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '模板ID不能为空'
      }, { status: 400 })
    }

    // 验证输入数据
    const validationResult = DeploymentTemplateSchema.partial().safeParse(updateData)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const templateData = validationResult.data

    console.log('📝 更新部署模板:', id)

    const prisma = await getPrismaClient()

    // 检查模板是否存在
    const existingTemplate = await prisma.deploymentTemplate.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json({
        success: false,
        error: '模板不存在'
      }, { status: 404 })
    }

    // 如果更新名称，检查是否与其他模板重名
    if (templateData.name && templateData.name !== existingTemplate.name) {
      const duplicateTemplate = await prisma.deploymentTemplate.findFirst({
        where: {
          name: templateData.name,
          id: { not: id }
        }
      })

      if (duplicateTemplate) {
        return NextResponse.json({
          success: false,
          error: '模板名称已存在'
        }, { status: 400 })
      }
    }

    // 更新模板
    const updatedTemplate = await prisma.deploymentTemplate.update({
      where: { id },
      data: {
        ...templateData,
        updatedAt: new Date()
      }
    })

    console.log('✅ 部署模板更新成功:', updatedTemplate.id)

    return NextResponse.json({
      success: true,
      data: {
        template: updatedTemplate
      }
    })
  } catch (error) {
    console.error('❌ [模板API] 更新模板失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新模板失败'
    }, { status: 500 })
  }
}

// 删除部署模板
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限删除部署模板' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '模板ID不能为空'
      }, { status: 400 })
    }

    console.log('🗑️ 删除部署模板:', id)

    const prisma = await getPrismaClient()

    // 检查模板是否存在
    const existingTemplate = await prisma.deploymentTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            deployments: true
          }
        }
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({
        success: false,
        error: '模板不存在'
      }, { status: 404 })
    }

    // 检查是否有部署任务在使用此模板
    if (existingTemplate._count.deployments > 0) {
      return NextResponse.json({
        success: false,
        error: '该模板正在被部署任务使用，无法删除'
      }, { status: 400 })
    }

    // 删除模板
    await prisma.deploymentTemplate.delete({
      where: { id }
    })

    console.log('✅ 部署模板删除成功:', id)

    return NextResponse.json({
      success: true,
      message: '模板删除成功'
    })
  } catch (error) {
    console.error('❌ [模板API] 删除模板失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除模板失败'
    }, { status: 500 })
  }
}
