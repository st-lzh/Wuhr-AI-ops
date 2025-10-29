import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


// 获取服务器状态
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json({
        success: false,
        error: '缺少服务器ID参数'
      }, { status: 400 })
    }

    const serverIds = idsParam.split(',').filter(id => id.trim())
    
    if (serverIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '无效的服务器ID列表'
      }, { status: 400 })
    }

    console.log(`📊 检查服务器状态: ${serverIds.length} 个服务器`)

    const prisma = await getPrismaClient()

    // 获取服务器信息
    const servers = await prisma.server.findMany({
      where: {
        id: {
          in: serverIds
        }
      },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true,
        location: true,
        os: true,
        version: true,
        tags: true,
        lastConnectedAt: true,
        updatedAt: true
      }
    })

    // 模拟实时状态检查
    const serversWithStatus = await Promise.all(
      servers.map(async (server) => {
        try {
          const now = new Date()
          const lastConnected = server.lastConnectedAt
          
          let realTimeStatus = server.status
          
          // 如果超过5分钟没有连接，标记为离线
          if (lastConnected) {
            const timeDiff = now.getTime() - lastConnected.getTime()
            const minutesDiff = timeDiff / (1000 * 60)
            
            if (minutesDiff > 5) {
              realTimeStatus = 'offline'
            } else if (minutesDiff > 2) {
              realTimeStatus = 'warning'
            } else {
              realTimeStatus = 'online'
            }
          } else {
            // 没有连接记录，模拟状态检查
            realTimeStatus = Math.random() > 0.3 ? 'online' : 'offline'
          }

          // 更新数据库中的状态（如果状态发生变化）
          if (realTimeStatus !== server.status) {
            await prisma.server.update({
              where: { id: server.id },
              data: { 
                status: realTimeStatus,
                lastConnectedAt: realTimeStatus === 'online' ? now : server.lastConnectedAt
              }
            })
          }

          return {
            id: server.id,
            name: server.name,
            hostname: server.hostname,
            ip: server.ip,
            port: server.port,
            status: realTimeStatus,
            location: server.location,
            os: server.os,
            version: server.version,
            tags: server.tags,
            lastConnectedAt: realTimeStatus === 'online' ? now : server.lastConnectedAt,
            updatedAt: now,
            environment: server.location || 'unknown'
          }
        } catch (error) {
          console.error(`❌ 检查服务器 ${server.id} 状态失败:`, error)
          return {
            ...server,
            status: 'error',
            environment: server.location || 'unknown'
          }
        }
      })
    )

    console.log(`✅ 服务器状态检查完成: ${serversWithStatus.length} 个服务器`)

    return NextResponse.json({
      success: true,
      data: {
        servers: serversWithStatus,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 获取服务器状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取服务器状态失败'
    }, { status: 500 })
  }
}
