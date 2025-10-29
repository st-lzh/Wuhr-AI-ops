import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 获取用户的默认配置（默认主机和默认模型）
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    // 获取默认主机
    const defaultServer = await prisma.server.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true
      }
    })

    // 获取默认模型配置
    const defaultModel = await prisma.modelConfig.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
        isActive: true
      },
      select: {
        id: true,
        modelName: true,
        displayName: true,
        provider: true,
        apiKey: true,
        baseUrl: true
      }
    })

    // 获取默认主机组
    const defaultGroup = await prisma.serverGroup.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        servers: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            name: true,
            hostname: true,
            ip: true,
            status: true
          }
        },
        _count: {
          select: {
            servers: true
          }
        }
      }
    })

    // 获取默认API Key配置（如果没有默认模型配置的话）
    const defaultApiKey = await prisma.apiKey.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        provider: true,
        apiKey: true,
        baseUrl: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        defaultServer,
        defaultModel,
        defaultGroup: defaultGroup ? {
          ...defaultGroup,
          serverCount: defaultGroup._count.servers
        } : null,
        defaultApiKey: !defaultModel ? defaultApiKey : null // 只有没有默认模型时才返回API Key
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ 获取默认配置失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '获取默认配置失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}