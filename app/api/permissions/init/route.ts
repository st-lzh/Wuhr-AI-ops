import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { SYSTEM_PERMISSIONS, ROLE_PERMISSIONS } from '../../../../lib/auth/permissions'

// POST /api/permissions/init - 初始化权限系统
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限 - admin角色自动拥有所有权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限初始化权限系统' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    
    console.log('🔐 [权限初始化] 开始初始化权限系统...', {
      userId: user.id,
      username: user.username
    })

    const results = {
      permissionsCreated: 0,
      permissionsUpdated: 0,
      usersUpdated: 0,
      errors: [] as string[]
    }

    try {
      // 1. 创建或更新权限记录
      console.log('📝 [权限初始化] 创建权限记录...')
      
      for (const permission of SYSTEM_PERMISSIONS) {
        try {
          // 尝试创建权限，如果已存在则更新
          const existingPermission = await prisma.permission.findUnique({
            where: { code: permission.code }
          })

          if (existingPermission) {
            // 更新现有权限
            await prisma.permission.update({
              where: { code: permission.code },
              data: {
                name: permission.name,
                description: permission.description,
                category: permission.category,
                updatedAt: new Date()
              }
            })
            results.permissionsUpdated++
            console.log(`  ✅ 更新权限: ${permission.name} (${permission.code})`)
          } else {
            // 创建新权限
            await prisma.permission.create({
              data: {
                id: permission.id,
                name: permission.name,
                code: permission.code,
                description: permission.description,
                category: permission.category,
                createdAt: new Date(permission.createdAt),
                updatedAt: new Date(permission.updatedAt)
              }
            })
            results.permissionsCreated++
            console.log(`  ✅ 创建权限: ${permission.name} (${permission.code})`)
          }
        } catch (error) {
          const errorMsg = `创建权限失败: ${permission.name} - ${error instanceof Error ? error.message : '未知错误'}`
          console.error(`  ❌ ${errorMsg}`)
          results.errors.push(errorMsg)
        }
      }

      // 2. 更新现有用户的权限
      console.log('👥 [权限初始化] 更新用户权限...')
      
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          permissions: true
        }
      })

      console.log(`📋 找到 ${users.length} 个用户需要更新权限`)

      for (const dbUser of users) {
        try {
          let newPermissions: string[] = []

          // 根据用户角色分配权限
          if (dbUser.role === 'admin') {
            newPermissions = [...ROLE_PERMISSIONS.admin]
          } else if (dbUser.role === 'manager') {
            newPermissions = [...ROLE_PERMISSIONS.manager]
          } else if (dbUser.role === 'developer') {
            newPermissions = [...ROLE_PERMISSIONS.developer]
          } else if (dbUser.role === 'viewer') {
            newPermissions = [...ROLE_PERMISSIONS.viewer]
          } else {
            // 默认给予基本权限
            newPermissions = [...ROLE_PERMISSIONS.viewer]
          }

          // 更新用户权限
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              permissions: newPermissions
            }
          })

          results.usersUpdated++
          console.log(`  ✅ 更新用户权限: ${dbUser.username} (${dbUser.role}) - ${newPermissions.length} 个权限`)
          
        } catch (error) {
          const errorMsg = `更新用户权限失败: ${dbUser.username} - ${error instanceof Error ? error.message : '未知错误'}`
          console.error(`  ❌ ${errorMsg}`)
          results.errors.push(errorMsg)
        }
      }

      // 3. 生成统计信息
      const permissionCount = await prisma.permission.count()
      const categories = Array.from(new Set(SYSTEM_PERMISSIONS.map(p => p.category)))
      
      console.log('📊 [权限初始化] 统计信息:')
      console.log(`  - 总权限数: ${permissionCount}`)
      console.log(`  - 权限类别: ${categories.length} 个`)
      categories.forEach(category => {
        const count = SYSTEM_PERMISSIONS.filter(p => p.category === category).length
        console.log(`    * ${category}: ${count} 个权限`)
      })

      console.log('🔑 [权限初始化] 角色权限分配:')
      Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
        console.log(`  - ${role}: ${permissions.length} 个权限`)
      })

      console.log('✅ [权限初始化] 权限系统初始化完成！')

      return NextResponse.json({
        success: true,
        data: {
          ...results,
          statistics: {
            totalPermissions: permissionCount,
            categories: categories.length,
            rolePermissions: Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
              role,
              permissionCount: permissions.length
            }))
          }
        },
        message: '权限系统初始化成功',
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('❌ [权限初始化] 初始化过程中发生错误:', error)
      results.errors.push(`初始化过程错误: ${error instanceof Error ? error.message : '未知错误'}`)
      
      return NextResponse.json({
        success: false,
        data: results,
        error: '权限系统初始化部分失败',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [权限初始化] 权限系统初始化失败:', error)
    return NextResponse.json(
      { success: false, error: '权限系统初始化失败' },
      { status: 500 }
    )
  }
}

// GET /api/permissions/init - 获取权限系统状态
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限 - admin角色自动拥有所有权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:read')) {
      return NextResponse.json(
        { success: false, error: '没有权限查看权限状态' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    
    console.log('🔐 [权限状态] 获取权限系统状态:', {
      userId: user.id
    })

    // 获取权限统计
    const permissionCount = await prisma.permission.count()
    const permissions = await prisma.permission.findMany({
      select: { category: true }
    })
    
    const categories = Array.from(new Set(permissions.map(p => p.category)))
    const categoryStats = categories.map(category => ({
      name: category,
      count: permissions.filter(p => p.category === category).length
    }))

    // 获取用户权限统计
    const users = await prisma.user.findMany({
      select: {
        role: true,
        permissions: true
      }
    })

    const roleStats: Record<string, any> = {}
    users.forEach(user => {
      if (!roleStats[user.role]) {
        roleStats[user.role] = {
          userCount: 0,
          avgPermissions: 0,
          totalPermissions: 0
        }
      }
      roleStats[user.role].userCount++
      roleStats[user.role].totalPermissions += user.permissions.length
    })

    // 计算平均权限数
    Object.keys(roleStats).forEach(role => {
      roleStats[role].avgPermissions = Math.round(
        roleStats[role].totalPermissions / roleStats[role].userCount
      )
    })

    return NextResponse.json({
      success: true,
      data: {
        permissions: {
          total: permissionCount,
          categories: categoryStats
        },
        users: {
          total: users.length,
          roleStats
        },
        systemPermissions: SYSTEM_PERMISSIONS.length,
        isInitialized: permissionCount > 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限状态] 获取权限系统状态失败:', error)
    return NextResponse.json(
      { success: false, error: '获取权限系统状态失败' },
      { status: 500 }
    )
  }
}
