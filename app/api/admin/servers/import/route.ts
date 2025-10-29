import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { hasPermission } from '../../../../../lib/auth/permissions'
import { getPrismaClient } from '../../../../../lib/config/database'
import bcrypt from 'bcryptjs'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'

interface ImportServerData {
  name: string
  hostname?: string
  ip: string
  port?: number
  username: string
  password: string
  os?: string
  location?: string
  description?: string
  tags?: string[]
  groupName?: string
  groupId?: string
}

// 导入服务器配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    if (!hasPermission(authResult.user.permissions, 'servers:write')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { servers } = body as { servers: ImportServerData[] }

    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供有效的服务器配置数据' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    const userId = authResult.user.id

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    // 获取用户现有的服务器，用于检查重复
    const existingServers = await prisma.server.findMany({
      where: { userId, isActive: true },
      select: { name: true, ip: true, hostname: true }
    })

    const existingNames = new Set(existingServers.map(s => s.name.toLowerCase()))
    const existingIPs = new Set(existingServers.map(s => s.ip))
    const existingHostnames = new Set(existingServers.map(s => s.hostname?.toLowerCase()).filter(Boolean))

    // 获取用户的所有主机组，用于名称匹配
    const userGroups = await prisma.serverGroup.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true }
    })
    
    const groupNameToId = new Map(userGroups.map(g => [g.name.toLowerCase(), g.id]))

    for (let i = 0; i < servers.length; i++) {
      const serverData = servers[i]
      const rowNum = i + 1

      try {
        // 基本验证
        if (!serverData.name || !serverData.ip || !serverData.username) {
          errors.push(`第 ${rowNum} 行：缺少必填字段（主机名称、IP地址、SSH用户名）`)
          continue
        }

        // IP格式验证
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
        if (!ipRegex.test(serverData.ip)) {
          errors.push(`第 ${rowNum} 行：IP地址格式不正确`)
          continue
        }

        // 检查重复
        if (existingNames.has(serverData.name.toLowerCase())) {
          errors.push(`第 ${rowNum} 行：主机名称 "${serverData.name}" 已存在`)
          skipped++
          continue
        }

        if (existingIPs.has(serverData.ip)) {
          errors.push(`第 ${rowNum} 行：IP地址 "${serverData.ip}" 已存在`)
          skipped++
          continue
        }

        if (serverData.hostname && existingHostnames.has(serverData.hostname.toLowerCase())) {
          errors.push(`第 ${rowNum} 行：主机名 "${serverData.hostname}" 已存在`)
          skipped++
          continue
        }

        // 处理主机组
        let groupId: string | null = null
        if (serverData.groupName) {
          groupId = groupNameToId.get(serverData.groupName.toLowerCase()) || null
          if (!groupId) {
            // 如果指定的主机组不存在，创建新的主机组
            try {
              const newGroup = await prisma.serverGroup.create({
                data: {
                  name: serverData.groupName,
                  description: `通过导入自动创建的主机组`,
                  color: '#1890ff',
                  icon: 'server',
                  tags: [],
                  userId,
                  isActive: true
                }
              })
              groupId = newGroup.id
              groupNameToId.set(serverData.groupName.toLowerCase(), groupId)
              console.log(`✅ 自动创建主机组: ${serverData.groupName}`)
            } catch (error) {
              console.error(`创建主机组失败:`, error)
              errors.push(`第 ${rowNum} 行：创建主机组 "${serverData.groupName}" 失败`)
              continue
            }
          }
        } else if (serverData.groupId) {
          // 如果提供了 groupId，验证是否属于当前用户
          const group = await prisma.serverGroup.findFirst({
            where: { id: serverData.groupId, userId, isActive: true }
          })
          if (group) {
            groupId = serverData.groupId
          }
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(serverData.password, 10)

        // 创建服务器记录
        await prisma.server.create({
          data: {
            name: serverData.name,
            hostname: serverData.hostname || serverData.name,
            ip: serverData.ip,
            port: serverData.port || 22,
            username: serverData.username,
            password: hashedPassword,
            os: serverData.os || 'Linux',
            location: serverData.location || '',
            description: serverData.description || '',
            tags: Array.isArray(serverData.tags) ? serverData.tags : [],
            status: 'offline', // 默认离线状态
            groupId,
            userId,
            isActive: true
          }
        })

        imported++
        
        // 更新重复检查集合
        existingNames.add(serverData.name.toLowerCase())
        existingIPs.add(serverData.ip)
        if (serverData.hostname) {
          existingHostnames.add(serverData.hostname.toLowerCase())
        }

      } catch (error) {
        console.error(`处理第 ${rowNum} 行数据失败:`, error)
        errors.push(`第 ${rowNum} 行：处理失败 - ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    console.log(`✅ 导入完成：成功 ${imported} 个，跳过 ${skipped} 个，错误 ${errors.length} 个`)

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        errors: errors.slice(0, 50), // 限制错误数量，避免响应过大
        total: servers.length
      }
    })

  } catch (error) {
    console.error('❌ 导入服务器配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '导入服务器配置失败'
    }, { status: 500 })
  }
}