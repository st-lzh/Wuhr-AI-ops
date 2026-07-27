import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import {
  createSSHConfigFromServer,
  performSSHReachabilityCheck
} from '../../../../lib/utils/sshConnectionUtils'

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

    const serverIds = Array.from(new Set(idsParam.split(',').map(id => id.trim()).filter(Boolean)))
    
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
        username: true,
        password: true,
        keyPath: true,
        lastConnectedAt: true,
        updatedAt: true
      }
    })

    // 使用真实 SSH 握手检查；分批限制并发，避免一次打开过多连接。
    const serversWithStatus: any[] = []
    for (let offset = 0; offset < servers.length; offset += 8) {
      const batch = servers.slice(offset, offset + 8)
      const batchResults = await Promise.all(batch.map(async (server) => {
        try {
          const now = new Date()
          const check = await performSSHReachabilityCheck(createSSHConfigFromServer(server))
          const realTimeStatus = check.success ? 'online' : 'offline'

          await prisma.server.update({
            where: { id: server.id },
            data: {
              status: realTimeStatus,
              lastConnectedAt: check.success ? now : server.lastConnectedAt
            }
          })

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
            environment: server.location || 'unknown',
            error: check.error
          }
        } catch (error) {
          console.error(`❌ 检查服务器 ${server.id} 状态失败:`, error)
          return {
            id: server.id,
            name: server.name,
            hostname: server.hostname,
            ip: server.ip,
            port: server.port,
            status: 'error',
            location: server.location,
            os: server.os,
            version: server.version,
            tags: server.tags,
            lastConnectedAt: server.lastConnectedAt,
            updatedAt: new Date(),
            environment: server.location || 'unknown',
            error: error instanceof Error ? error.message : '状态检查失败'
          }
        }
      }))
      serversWithStatus.push(...batchResults)
    }

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
