import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'

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

// 获取单个部署模板
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const templateId = params.id

    console.log('📋 获取部署模板详情:', templateId)

    const prisma = await getPrismaClient()
    const template = await prisma.deploymentTemplate.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: {
            deployments: true
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({
        success: false,
        error: '模板不存在'
      }, { status: 404 })
    }

    // 转换数据格式
    const templateWithUsage = {
      ...template,
      usageCount: template._count.deployments,
      _count: undefined
    }

    console.log('✅ 获取模板详情成功:', template.name)

    return NextResponse.json({
      success: true,
      data: {
        template: templateWithUsage
      }
    })
  } catch (error) {
    console.error('❌ [模板API] 获取模板详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取模板详情失败'
    }, { status: 500 })
  }
}

// 更新部署模板
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('cicd:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限修改部署模板' },
        { status: 403 }
      )
    }

    const templateId = params.id
    const body = await request.json()

    // 验证输入数据
    const validationResult = DeploymentTemplateSchema.partial().safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const templateData = validationResult.data

    console.log('📝 更新部署模板:', templateId)

    const prisma = await getPrismaClient()

    // 检查模板是否存在
    const existingTemplate = await prisma.deploymentTemplate.findUnique({
      where: { id: templateId }
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
          id: { not: templateId }
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
      where: { id: templateId },
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('cicd:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限删除部署模板' },
        { status: 403 }
      )
    }

    const templateId = params.id

    console.log('🗑️ 删除部署模板:', templateId)

    const prisma = await getPrismaClient()

    // 检查模板是否存在
    const existingTemplate = await prisma.deploymentTemplate.findUnique({
      where: { id: templateId },
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
      where: { id: templateId }
    })

    console.log('✅ 部署模板删除成功:', templateId)

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
