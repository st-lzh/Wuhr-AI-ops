import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

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

    const body = await request.json()

    console.log('📝 创建Jenkins CI/CD配置:', body)

    // 获取当前用户ID（从认证结果中）
    const userId = authResult.user.id

    // 保存到数据库
    const prisma = await getPrismaClient()
    const newConfig = await prisma.jenkinsConfig.create({
      data: {
        name: body.name,
        serverUrl: body.url || body.serverUrl,
        username: body.username,
        apiToken: body.apiToken,
        description: body.description || '',
        isActive: body.enabled !== false,
        userId: userId,
        config: body // 保存完整配置到JSON字段
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
