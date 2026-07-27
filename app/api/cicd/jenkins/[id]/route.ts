import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'
import { protectSecret } from '../../../../../lib/crypto/encryption'
import { canWriteTeamAssets } from '../../../../../lib/auth/teamAccess'

// Jenkins配置更新验证schema
const UpdateJenkinsConfigSchema = z.object({
  name: z.string().min(1, '配置名称不能为空').max(100, '配置名称过长').optional(),
  description: z.string().optional(),
  serverUrl: z.string().url('请输入有效的Jenkins服务器URL').optional(),
  username: z.string().optional(),
  apiToken: z.string().optional(),

  webhookUrl: z.string().url().optional(),
  config: z.any().optional(),
  isActive: z.boolean().optional()
})

// 获取单个Jenkins配置详情
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
    const configId = params.id
    const prisma = await getPrismaClient()

    console.log('🔍 获取Jenkins配置详情:', { configId, userId: user.id })

    // 查询Jenkins配置
    const config = await prisma.jenkinsConfig.findFirst({
      where: {
        id: configId
      }
    })

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在'
      }, { status: 404 })
    }

    console.log('✅ Jenkins配置详情获取成功:', configId)

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        description: config.description,
        serverUrl: config.serverUrl,
        username: config.username,
        webhookUrl: config.webhookUrl,
        isActive: config.isActive,
        lastTestAt: config.lastTestAt,
        testStatus: config.testStatus,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }
    })

  } catch (error) {
    console.error('❌ 获取Jenkins配置详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取Jenkins配置详情失败'
    }, { status: 500 })
  }
}

// 更新Jenkins配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有 Jenkins 配置写入权限' }, { status: 403 })
    }
    const configId = params.id
    const body = await request.json()

    // 验证输入数据
    const validationResult = UpdateJenkinsConfigSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const data = validationResult.data
    const prisma = await getPrismaClient()

    console.log('📝 更新Jenkins配置:', { configId, userId: user.id })

    // 检查配置是否存在
    const existingConfig = await prisma.jenkinsConfig.findFirst({
      where: {
        id: configId
      }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在'
      }, { status: 404 })
    }

    // 更新Jenkins配置
    const { apiToken, ...safeData } = data
    const updatedConfig = await prisma.jenkinsConfig.update({
      where: { id: configId },
      data: {
        ...safeData,
        ...(apiToken?.trim() ? { apiToken: protectSecret(apiToken) } : {}),
        updatedAt: new Date()
      }
    })

    console.log('✅ Jenkins配置更新成功:', configId)

    return NextResponse.json({
      success: true,
      data: {
        id: updatedConfig.id,
        name: updatedConfig.name,
        description: updatedConfig.description,
        serverUrl: updatedConfig.serverUrl,
        username: updatedConfig.username,
        webhookUrl: updatedConfig.webhookUrl,
        isActive: updatedConfig.isActive,
        lastTestAt: updatedConfig.lastTestAt,
        testStatus: updatedConfig.testStatus,
        createdAt: updatedConfig.createdAt,
        updatedAt: updatedConfig.updatedAt
      },
      message: 'Jenkins配置更新成功'
    })

  } catch (error) {
    console.error('❌ 更新Jenkins配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新Jenkins配置失败'
    }, { status: 500 })
  }
}

// 删除Jenkins配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有 Jenkins 配置写入权限' }, { status: 403 })
    }
    const configId = params.id
    const prisma = await getPrismaClient()

    console.log('🗑️ 删除Jenkins配置:', { configId, userId: user.id })

    // 检查配置是否存在
    const existingConfig = await prisma.jenkinsConfig.findFirst({
      where: {
        id: configId
      }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在'
      }, { status: 404 })
    }

    // 删除Jenkins配置
    await prisma.jenkinsConfig.delete({
      where: { id: configId }
    })

    console.log('✅ Jenkins配置删除成功:', configId)

    return NextResponse.json({
      success: true,
      message: 'Jenkins配置删除成功'
    })

  } catch (error) {
    console.error('❌ 删除Jenkins配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除Jenkins配置失败'
    }, { status: 500 })
  }
}
