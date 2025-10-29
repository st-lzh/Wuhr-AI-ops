import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { hasPermission } from '../../../../../lib/auth/permissions'
import { getPrismaClient } from '../../../../../lib/config/database'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'

// 导出服务器配置
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    if (!hasPermission(authResult.user.permissions, 'servers:read')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()

    // 获取用户的所有服务器（包含主机组信息）
    const servers = await prisma.server.findMany({
      where: {
        userId: authResult.user.id,
        isActive: true
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    console.log(`✅ 导出服务器配置，共 ${servers.length} 台服务器`)

    return NextResponse.json({
      success: true,
      data: {
        servers: servers.map(server => ({
          id: server.id,
          name: server.name,
          hostname: server.hostname,
          ip: server.ip,
          port: server.port,
          username: server.username,
          // 不导出密码，出于安全考虑
          os: server.os,
          location: server.location,
          description: server.description,
          tags: server.tags,
          status: server.status,
          groupId: server.groupId,
          groupName: server.group?.name || null,
          groupColor: server.group?.color || null,
          groupDescription: server.group?.description || null,
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
          lastConnectedAt: server.lastConnectedAt
        })),
        total: servers.length,
        exportedAt: new Date()
      }
    })

  } catch (error) {
    console.error('❌ 导出服务器配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '导出服务器配置失败'
    }, { status: 500 })
  }
}