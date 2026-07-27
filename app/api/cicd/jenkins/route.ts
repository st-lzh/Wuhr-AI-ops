import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { protectSecret } from '../../../../lib/crypto/encryption'
import { canWriteTeamAssets } from '../../../../lib/auth/teamAccess'

// 获取Jenkins配置列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    console.log('📋 获取Jenkins CI/CD配置列表')

    // 从数据库获取Jenkins配置
    const prisma = await getPrismaClient()
    const configs = await prisma.jenkinsConfig.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        description: true,
        serverUrl: true,
        username: true,
        webhookUrl: true,
        isActive: true,
        lastTestAt: true,
        testStatus: true,
        createdAt: true,
        updatedAt: true
      }
    })

    console.log('📋 找到Jenkins配置:', configs.length, '个')

    return NextResponse.json({
      success: true,
      data: {
        configs: configs,
        total: configs.length
      }
    })
  } catch (error) {
    console.error('获取Jenkins配置列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取Jenkins配置列表失败'
    }, { status: 500 })
  }
}

// 创建Jenkins配置
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    if (!canWriteTeamAssets(authResult.user, 'cicd:write')) {
      return NextResponse.json({ success: false, error: '没有 Jenkins 配置写入权限' }, { status: 403 })
    }

    const body = await request.json()

    console.log('📝 创建Jenkins CI/CD配置:', { name: body.name, serverUrl: body.url || body.serverUrl })

    // 获取当前用户ID（从认证结果中）
    const userId = authResult.user.id

    // 保存到数据库
    const prisma = await getPrismaClient()
    const { apiToken, ...safeConfig } = body
    const newConfig = await prisma.jenkinsConfig.create({
      data: {
        name: body.name,
        serverUrl: body.url || body.serverUrl,
        username: body.username,
        apiToken: apiToken?.trim() ? protectSecret(apiToken) : null,
        description: body.description || '',
        isActive: body.isActive ?? (body.enabled !== false),
        userId: userId,
        config: safeConfig
      },
      select: {
        id: true,
        name: true,
        description: true,
        serverUrl: true,
        username: true,
        webhookUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    console.log('📝 Jenkins配置已保存到数据库:', newConfig.id)

    return NextResponse.json({
      success: true,
      message: 'Jenkins配置创建成功',
      data: newConfig
    })
  } catch (error) {
    console.error('创建Jenkins配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建Jenkins配置失败'
    }, { status: 500 })
  }
}
