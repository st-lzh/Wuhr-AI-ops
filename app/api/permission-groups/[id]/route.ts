import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

// GET /api/permission-groups/[id] - 获取权限组详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:read')) {
      return NextResponse.json(
        { success: false, error: '没有权限查看权限组详情' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    const groupId = params.id

    console.log('🔐 [权限组API] 获取权限组详情:', {
      userId: user.id,
      groupId
    })

    // 获取权限组详情
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    if (!permissionGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 格式化数据
    const formattedGroup = {
      id: permissionGroup.id,
      name: permissionGroup.name,
      description: permissionGroup.description,
      createdAt: permissionGroup.createdAt,
      updatedAt: permissionGroup.updatedAt,
      permissionCount: permissionGroup.permissions.length,
      userCount: permissionGroup.users.length,
      permissions: permissionGroup.permissions.map(p => p.permission),
      users: permissionGroup.users.map(u => u.user)
    }

    console.log('✅ [权限组API] 权限组详情获取成功:', groupId)

    return NextResponse.json({
      success: true,
      data: formattedGroup,
      message: '权限组详情获取成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组API] 获取权限组详情错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取权限组详情失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// PUT /api/permission-groups/[id] - 更新权限组
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限更新权限组' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description } = body
    const groupId = params.id

    console.log('🔐 [权限组API] 更新权限组:', {
      userId: user.id,
      groupId,
      name,
      description
    })

    // 验证必填字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: '权限组名称为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限组是否存在
    const existingGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId }
    })

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 检查名称是否与其他权限组冲突
    const nameConflict = await prisma.permissionGroup.findFirst({
      where: { 
        name,
        id: { not: groupId }
      }
    })

    if (nameConflict) {
      return NextResponse.json(
        { success: false, error: '权限组名称已存在' },
        { status: 400 }
      )
    }

    // 更新权限组
    const updatedGroup = await prisma.permissionGroup.update({
      where: { id: groupId },
      data: {
        name,
        description
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })

    console.log('✅ [权限组API] 权限组更新成功:', groupId)

    // 格式化返回数据
    const formattedGroup = {
      id: updatedGroup.id,
      name: updatedGroup.name,
      description: updatedGroup.description,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt,
      permissionCount: updatedGroup.permissions.length,
      userCount: updatedGroup.users.length,
      permissions: updatedGroup.permissions.map(p => p.permission),
      users: updatedGroup.users.map(u => u.user)
    }

    return NextResponse.json({
      success: true,
      data: formattedGroup,
      message: '权限组更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组API] 更新权限组错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '更新权限组失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/permission-groups/[id] - 删除权限组
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    // 检查权限
    const userPermissions = user.permissions || []
    if (user.role !== 'admin' && !userPermissions.includes('permissions:write')) {
      return NextResponse.json(
        { success: false, error: '没有权限删除权限组' },
        { status: 403 }
      )
    }

    const groupId = params.id
    const prisma = await getPrismaClient()

    console.log('🔐 [权限组API] 删除权限组:', {
      userId: user.id,
      groupId
    })

    // 检查权限组是否存在
    const existingGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        users: true
      }
    })

    if (!existingGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 检查是否有用户关联到此权限组
    if (existingGroup.users.length > 0) {
      return NextResponse.json(
        { success: false, error: '无法删除权限组，还有用户关联到此权限组' },
        { status: 400 }
      )
    }

    // 删除权限组（关联的权限会自动删除，因为设置了 onDelete: Cascade）
    await prisma.permissionGroup.delete({
      where: { id: groupId }
    })

    console.log('✅ [权限组API] 权限组删除成功:', groupId)

    return NextResponse.json({
      success: true,
      message: '权限组删除成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组API] 删除权限组错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '删除权限组失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
