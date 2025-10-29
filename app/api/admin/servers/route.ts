import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
// 延迟加载 SSH 客户端以避免在构建时加载原生模块
// import { SSHClient } from '../../../../lib/ssh/client'
import { withLeakDetection } from '../../../../lib/database/leakDetector'
import { ServerStatus } from '../../../../lib/generated/prisma'

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

// 获取主机列表
export async function GET(request: NextRequest) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const location = searchParams.get('location') || ''

    const prisma = await getPrismaClient()
    
    // 构建查询条件
    const where: any = {}

    // 如果指定了ID，只查询该服务器
    const id = request.nextUrl.searchParams.get('id')
    if (id) {
      where.id = id
    } else {
      // 否则应用其他筛选条件
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { hostname: { contains: search, mode: 'insensitive' } },
          { ip: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }
      if (status) {
        where.status = status
      }
      if (location) {
        where.location = { contains: location, mode: 'insensitive' }
      }
    }

    // 检查是否需要包含SSH配置（用于编辑）
    const includeSSH = request.nextUrl.searchParams.get('includeSSH') === 'true'

    // 获取主机列表
    const servers = await prisma.server.findMany({
      where,
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true,
        os: true,
        version: true,
        location: true,
        tags: true,
        description: true,
        isDefault: true, // 包含默认状态
        createdAt: true,
        updatedAt: true,
        lastConnectedAt: true,
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        // 只在需要时包含SSH配置
        ...(includeSSH && {
          username: true,
          keyPath: true
          // 注意：出于安全考虑，不返回密码
        })
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    // 获取总数
    const totalServers = await prisma.server.count({ where })

    return successResponse({
      servers,
      pagination: {
        page,
        limit,
        total: totalServers,
        pages: Math.ceil(totalServers / limit)
      }
    })

  } catch (error) {
    console.error('❌ 获取主机列表错误:', error)
    return serverErrorResponse(error)
  }
}

// 添加新主机
export async function POST(request: NextRequest) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { 
      name, 
      hostname, 
      ip, 
      port = 22, 
      username, 
      password, 
      keyPath,
      os, 
      version, 
      location, 
      tags = [], 
      description,
      groupId,
      isDefault = false
    } = body

    // 验证必要参数
    if (!name || !hostname || !ip || !username) {
      return errorResponse('缺少必要参数', 'name、hostname、ip和username是必需的', 400)
    }

    // 验证IP格式
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (!ipRegex.test(ip)) {
      return errorResponse('IP地址格式错误', '请输入有效的IP地址', 400)
    }

    // 验证端口范围
    if (port < 1 || port > 65535) {
      return errorResponse('端口范围错误', '端口必须在1-65535之间', 400)
    }

    const prisma = await getPrismaClient()

    // 检查IP和主机名是否已存在
    const existingServer = await prisma.server.findFirst({
      where: {
        OR: [
          { ip },
          { hostname }
        ]
      }
    })

    if (existingServer) {
      return errorResponse('主机已存在', '该IP地址或主机名已被使用', 400)
    }

    // 先测试连接以确定初始状态
    let initialStatus: ServerStatus = ServerStatus.offline
    let lastConnectedAt: Date | null = null

    // 如果设置为默认主机，先将用户的其他主机的isDefault设为false
    if (isDefault) {
      await prisma.server.updateMany({
        where: {
          userId: authResult.user.id,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    try {
      // 验证认证信息
      if (password || keyPath) {
        // 动态加载 SSH 客户端
        const { SSHClient } = await import('../../../../lib/ssh/client')
        const sshClient = new SSHClient({
          host: ip,
          port,
          username,
          password,
          privateKey: keyPath
        })

        await sshClient.connect()
        const testResult = { success: true }
        if (testResult.success) {
          initialStatus = ServerStatus.online
          lastConnectedAt = new Date()
        }
      }
    } catch (error) {
      // 连接测试失败，保持默认离线状态
    }

    // 创建新主机
    const newServer = await prisma.server.create({
      data: {
        name,
        hostname,
        ip,
        port,
        username,
        password: password || null,
        keyPath: keyPath || null,
        os: os || 'Unknown',
        version: version || 'Unknown',
        location: location || '未知',
        tags: tags,
        description: description || null,
        status: initialStatus, // 使用测试结果确定的状态
        lastConnectedAt,
        userId: authResult.user.id, // 设置创建者
        groupId: groupId || null, // 设置主机组
        isDefault, // 设置默认主机状态
        createdAt: new Date(),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true,
        os: true,
        version: true,
        location: true,
        tags: true,
        description: true,
        isDefault: true, // 包含默认状态
        groupId: true,
        createdAt: true,
        updatedAt: true
      }
    })



    return successResponse({
      message: '主机添加成功',
      server: newServer
    })

  } catch (error) {
    console.error('❌ 添加主机失败:', error)
    return serverErrorResponse(error)
  }
}

// 更新主机信息
export async function PUT(request: NextRequest) {
  return await withLeakDetection('update-server', async () => {
    try {
      // 权限检查 - 只需要登录即可
      const authResult = await requireAuth(request)
      if (!authResult.success) {
        return authResult.response
      }

      const body = await request.json()
      const { id, name, hostname, ip, port, username, password, keyPath, os, version, location, tags, description, isDefault = false } = body

      // 验证必要参数
      if (!id) {
        return errorResponse('缺少主机ID', '主机ID是必需的', 400)
      }

    const prisma = await getPrismaClient()

    // 检查主机是否存在
    const existingServer = await prisma.server.findUnique({
      where: { id }
    })

    if (!existingServer) {
      return errorResponse('主机不存在', '指定的主机不存在', 404)
    }

    // 如果更新IP或主机名，检查是否与其他主机冲突
    if ((ip && ip !== existingServer.ip) || (hostname && hostname !== existingServer.hostname)) {
      const conflictServer = await prisma.server.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(ip ? [{ ip }] : []),
                ...(hostname ? [{ hostname }] : [])
              ]
            }
          ]
        }
      })

      if (conflictServer) {
        return errorResponse('主机信息冲突', '该IP地址或主机名已被其他主机使用', 400)
      }
    }

    // 如果设置为默认主机，先将用户的其他主机的isDefault设为false
    if (isDefault) {
      await prisma.server.updateMany({
        where: {
          userId: authResult.user.id,
          isDefault: true,
          id: { not: id } // 排除当前更新的主机
        },
        data: {
          isDefault: false
        }
      })
    }

    // 更新主机信息
    const updatedServer = await prisma.server.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(hostname && { hostname }),
        ...(ip && { ip }),
        ...(port && { port }),
        ...(username && { username }),
        // 只有当密码不为空时才更新密码
        ...(password && password.trim() !== '' && { password }),
        ...(keyPath !== undefined && { keyPath }),
        ...(os && { os }),
        ...(version && { version }),
        ...(location && { location }),
        ...(tags && { tags }),
        ...(description !== undefined && { description }),
        isDefault, // 更新默认状态
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        hostname: true,
        ip: true,
        port: true,
        status: true,
        os: true,
        version: true,
        location: true,
        tags: true,
        description: true,
        isDefault: true, // 包含默认状态
        createdAt: true,
        updatedAt: true
      }
    })



    return successResponse({
      message: '主机信息更新成功',
      server: updatedServer
    })

    } catch (error) {
      console.error('❌ 更新主机信息失败:', error)
      return serverErrorResponse(error)
    }
  })
}

// 更新主机状态和连接测试
export async function PATCH(request: NextRequest) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { id, action, ...updateData } = body

    // 验证必要参数
    if (!id || !action) {
      return errorResponse('缺少必要参数', 'id和action是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 检查主机是否存在
    const existingServer = await prisma.server.findUnique({
      where: { id }
    })

    if (!existingServer) {
      return errorResponse('主机不存在', '指定的主机不存在', 404)
    }

    let updatedServer
    let message = ''

    switch (action) {
      case 'test_connection':
        // 连接测试
        try {
          // 动态加载 SSH 客户端
          const { SSHClient } = await import('../../../../lib/ssh/client')
          // 实现真实的SSH连接测试
          const sshClient = new SSHClient({
            host: existingServer.ip,
            port: existingServer.port,
            username: existingServer.username || 'root',
            password: existingServer.password || undefined,
            privateKey: existingServer.keyPath || undefined
          })

          try {
            await sshClient.connect()


            updatedServer = await prisma.server.update({
              where: { id },
              data: {
                status: ServerStatus.online,
                lastConnectedAt: new Date(),
                updatedAt: new Date()
              },
              select: {
                id: true,
                name: true,
                hostname: true,
                ip: true,
                port: true,
                status: true,
                os: true,
                version: true,
                location: true,
                tags: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                lastConnectedAt: true
              }
            })

            message = '连接测试成功'
          } catch (connectError) {
            updatedServer = await prisma.server.update({
              where: { id },
              data: {
                status: ServerStatus.offline,
                updatedAt: new Date()
              },
              select: {
                id: true,
                name: true,
                hostname: true,
                ip: true,
                port: true,
                status: true,
                os: true,
                version: true,
                location: true,
                tags: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                lastConnectedAt: true
              }
            })

            message = '连接测试失败'
          }
        } catch (error) {
          message = '连接测试失败'
        }
        break

      case 'update_status':
        // 手动更新状态
        const { status } = updateData
        if (!status || !['online', 'offline', 'warning', 'error'].includes(status)) {
          return errorResponse('无效的状态', '状态必须是 online、offline、warning 或 error', 400)
        }

        updatedServer = await prisma.server.update({
          where: { id },
          data: {
            status,
            updatedAt: new Date()
          },
          select: {
            id: true,
            name: true,
            hostname: true,
            ip: true,
            port: true,
            status: true,
            os: true,
            version: true,
            location: true,
            tags: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            lastConnectedAt: true
          }
        })

        message = `主机状态已更新为${status}`
        break



      default:
        return errorResponse('无效的操作', `不支持的操作: ${action}`, 400)
    }

    return successResponse({
      message,
      server: updatedServer
    })

  } catch (error) {
    console.error('❌ 更新主机状态失败:', error)
    return serverErrorResponse(error)
  }
}

// 删除主机
export async function DELETE(request: NextRequest) {
  try {
    // 权限检查 - 只需要登录即可
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // 验证必要参数
    if (!id) {
      return errorResponse('缺少主机ID', '主机ID是必需的', 400)
    }

    const prisma = await getPrismaClient()

    // 检查主机是否存在
    const existingServer = await prisma.server.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ip: true
      }
    })

    if (!existingServer) {
      return errorResponse('主机不存在', '指定的主机不存在', 404)
    }

    // 删除主机
    await prisma.server.delete({
      where: { id }
    })



    return successResponse({
      message: '主机删除成功',
      deletedServer: {
        id: existingServer.id,
        name: existingServer.name,
        ip: existingServer.ip
      }
    })

  } catch (error) {
    console.error('❌ 删除主机失败:', error)
    return serverErrorResponse(error)
  }
}
