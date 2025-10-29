import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'
import {
  performSSHConnectionTest,
  createSSHConfigFromServer
} from '../../../../../../lib/utils/sshConnectionUtils'

// 响应辅助函数
function successResponse(data: any) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  })
}

function errorResponse(error: string, details?: string, status: number = 400) {
  return NextResponse.json({
    success: false,
    error,
    details,
    timestamp: new Date().toISOString()
  }, { status })
}

function serverErrorResponse(error: any) {
  console.error('API错误:', error)
  return NextResponse.json({
    success: false,
    error: '服务器内部错误',
    timestamp: new Date().toISOString()
  }, { status: 500 })
}

// 根据主机ID进行连接测试
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const serverId = params.id

    // 验证主机ID
    if (!serverId) {
      return errorResponse('缺少主机ID', '主机ID是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 获取主机信息，包括认证信息
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        username: true,
        password: true,
        keyPath: true,
        status: true
      }
    })

    if (!server) {
      return errorResponse('主机不存在', '指定的主机不存在', 404)
    }

    // 验证认证信息
    if (!server.password && !server.keyPath) {
      return errorResponse('缺少认证信息', '主机缺少密码或SSH密钥配置', 400)
    }

    // 创建SSH连接配置
    const sshConfig = createSSHConfigFromServer(server)

    // 执行SSH连接测试
    const testResult = await performSSHConnectionTest(sshConfig, server.name)

    if (testResult.success) {
      // 更新主机状态为在线
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: 'online',
          lastConnectedAt: new Date(),
          updatedAt: new Date()
        }
      })

      return successResponse({
        message: testResult.message,
        connected: testResult.connected,
        systemInfo: testResult.systemInfo,
        connectionTime: testResult.connectionTime
      })
    } else {
      // 更新主机状态为离线
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: 'offline',
          updatedAt: new Date()
        }
      })

      return errorResponse(testResult.message, testResult.error, 400)
    }

  } catch (error) {
    return serverErrorResponse(error)
  }
}
