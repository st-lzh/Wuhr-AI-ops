import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

// GET /api/permission-groups/[id]/permissions - 获取权限组的权限列表
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
        { success: false, error: '没有权限查看权限组权限' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    const groupId = params.id

    console.log('🔐 [权限组权限API] 获取权限组权限:', {
      userId: user.id,
      groupId
    })

    // 检查权限组是否存在
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        permissions: {
          include: {
            permission: true
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

    // 获取所有可用权限
    const allPermissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // 格式化数据
    const groupPermissions = permissionGroup.permissions.map(p => p.permission)
    const availablePermissions = allPermissions.filter(
      p => !groupPermissions.some(gp => gp.id === p.id)
    )

    console.log('✅ [权限组权限API] 权限组权限获取成功:', groupId)

    return NextResponse.json({
      success: true,
      data: {
        group: {
          id: permissionGroup.id,
          name: permissionGroup.name,
          description: permissionGroup.description
        },
        assignedPermissions: groupPermissions,
        availablePermissions: availablePermissions
      },
      message: '权限组权限获取成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组权限API] 获取权限组权限错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取权限组权限失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// PUT /api/permission-groups/[id]/permissions - 更新权限组的权限
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
        { success: false, error: '没有权限修改权限组权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { permissionIds } = body
    const groupId = params.id

    console.log('🔐 [权限组权限API] 更新权限组权限:', {
      userId: user.id,
      groupId,
      permissionIds
    })

    // 验证输入
    if (!Array.isArray(permissionIds)) {
      return NextResponse.json(
        { success: false, error: '权限ID列表格式错误' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限组是否存在
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId }
    })

    if (!permissionGroup) {
      return NextResponse.json(
        { success: false, error: '权限组不存在' },
        { status: 404 }
      )
    }

    // 验证所有权限ID是否有效
    if (permissionIds.length > 0) {
      const validPermissions = await prisma.permission.findMany({
        where: {
          id: { in: permissionIds }
        }
      })

      if (validPermissions.length !== permissionIds.length) {
        return NextResponse.json(
          { success: false, error: '包含无效的权限ID' },
          { status: 400 }
        )
      }
    }

    // 使用事务更新权限组权限
    await prisma.$transaction(async (tx) => {
      // 删除现有的权限关联
      await tx.permissionGroupPermission.deleteMany({
        where: { groupId }
      })

      // 添加新的权限关联
      if (permissionIds.length > 0) {
        await tx.permissionGroupPermission.createMany({
          data: permissionIds.map((permissionId: string) => ({
            groupId,
            permissionId
          }))
        })
      }
    })

    // 获取更新后的权限组信息
    const updatedGroup = await prisma.permissionGroup.findUnique({
      where: { id: groupId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    console.log('✅ [权限组权限API] 权限组权限更新成功:', groupId)

    return NextResponse.json({
      success: true,
      data: {
        group: {
          id: updatedGroup!.id,
          name: updatedGroup!.name,
          description: updatedGroup!.description
        },
        permissions: updatedGroup!.permissions.map(p => p.permission)
      },
      message: '权限组权限更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限组权限API] 更新权限组权限错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '更新权限组权限失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}
