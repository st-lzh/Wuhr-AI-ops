import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../lib/config/database'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// 获取服务器列表 - 简化版本，用于项目管理等场景
export async function GET(request: NextRequest) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('📋 获取服务器列表（简化版）')

    const prisma = await getPrismaClient()
    
    // 检查是否只获取未分组的主机
    const url = new URL(request.url)
    const ungrouped = url.searchParams.get('ungrouped') === 'true'

    // 构建查询条件
    const whereCondition: any = {
      userId: authResult.user.id,
      isActive: true
    }
    
    if (ungrouped) {
      whereCondition.groupId = null
    }

    // 获取服务器列表 - 只返回基本信息
    const servers = await prisma.server.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true,
        os: true,
        location: true,
        description: true,
        groupId: true,
        createdAt: true,
        lastConnectedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    console.log(`✅ 获取服务器列表成功，共 ${servers.length} 台服务器${ungrouped ? '（仅未分组）' : ''}`)

    return NextResponse.json({
      success: true,
      data: {
        servers: servers.map(server => ({
          ...server,
          available: server.status === 'online',
          environment: server.location || 'unknown', // 添加environment字段
          groupName: server.group?.name || null,
          groupColor: server.group?.color || null
        })),
        total: servers.length
      }
    })

  } catch (error) {
    console.error('❌ 获取服务器列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取服务器列表失败'
    }, { status: 500 })
  }
}
