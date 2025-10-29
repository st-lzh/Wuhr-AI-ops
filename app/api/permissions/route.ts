import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../lib/config/database'
import { SYSTEM_PERMISSIONS, PERMISSION_CATEGORIES } from '../../../lib/auth/permissions'

// GET /api/permissions - 获取权限列表
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
        { success: false, error: '没有权限查看权限列表' },
        { status: 403 }
      )
    }

    const prisma = await getPrismaClient()
    
    // 获取URL参数
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeCategories = searchParams.get('includeCategories') === 'true'
    
    console.log('🔐 [权限API] 获取权限列表:', {
      userId: user.id,
      category,
      includeCategories
    })

    // 查询权限
    const whereClause = category ? { category } : {}
    
    const permissions = await prisma.permission.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { code: 'asc' }
      ]
    })

    console.log('🔐 [权限API] 查询结果:', {
      totalPermissions: permissions.length,
      categories: Array.from(new Set(permissions.map(p => p.category)))
    })

    // 如果需要包含分类信息
    if (includeCategories) {
      const categories = PERMISSION_CATEGORIES.map(cat => ({
        ...cat,
        permissions: permissions.filter(p => p.category === cat.name)
      }))

      return NextResponse.json({
        success: true,
        data: {
          permissions,
          categories,
          total: permissions.length
        },
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        permissions,
        total: permissions.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限API] 获取权限列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取权限列表失败' },
      { status: 500 }
    )
  }
}

// POST /api/permissions - 创建权限
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
        { success: false, error: '没有权限创建权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, description, category } = body

    console.log('🔐 [权限API] 创建权限:', {
      userId: user.id,
      name,
      code,
      category
    })

    // 验证必填字段
    if (!name || !code || !category) {
      return NextResponse.json(
        { success: false, error: '权限名称、代码和类别为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限代码是否已存在
    const existingPermission = await prisma.permission.findUnique({
      where: { code }
    })

    if (existingPermission) {
      return NextResponse.json(
        { success: false, error: '权限代码已存在' },
        { status: 400 }
      )
    }

    // 创建权限
    const permission = await prisma.permission.create({
      data: {
        name,
        code,
        description,
        category
      }
    })

    console.log('✅ [权限API] 权限创建成功:', permission.id)

    return NextResponse.json({
      success: true,
      data: permission,
      message: '权限创建成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限API] 创建权限失败:', error)
    return NextResponse.json(
      { success: false, error: '创建权限失败' },
      { status: 500 }
    )
  }
}

// PUT /api/permissions - 更新权限
export async function PUT(request: NextRequest) {
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
        { success: false, error: '没有权限修改权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, description, category } = body

    console.log('🔐 [权限API] 更新权限:', {
      userId: user.id,
      permissionId: id,
      name,
      category
    })

    // 验证必填字段
    if (!id || !name || !category) {
      return NextResponse.json(
        { success: false, error: '权限ID、名称和类别为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限是否存在
    const existingPermission = await prisma.permission.findUnique({
      where: { id }
    })

    if (!existingPermission) {
      return NextResponse.json(
        { success: false, error: '权限不存在' },
        { status: 404 }
      )
    }

    // 更新权限
    const permission = await prisma.permission.update({
      where: { id },
      data: {
        name,
        description,
        category,
        updatedAt: new Date()
      }
    })

    console.log('✅ [权限API] 权限更新成功:', permission.id)

    return NextResponse.json({
      success: true,
      data: permission,
      message: '权限更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限API] 更新权限失败:', error)
    return NextResponse.json(
      { success: false, error: '更新权限失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/permissions - 删除权限
export async function DELETE(request: NextRequest) {
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
        { success: false, error: '没有权限删除权限' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    console.log('🔐 [权限API] 删除权限:', {
      userId: user.id,
      permissionId: id
    })

    if (!id) {
      return NextResponse.json(
        { success: false, error: '权限ID为必填项' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()

    // 检查权限是否存在
    const existingPermission = await prisma.permission.findUnique({
      where: { id }
    })

    if (!existingPermission) {
      return NextResponse.json(
        { success: false, error: '权限不存在' },
        { status: 404 }
      )
    }

    // 删除权限
    await prisma.permission.delete({
      where: { id }
    })

    console.log('✅ [权限API] 权限删除成功:', id)

    return NextResponse.json({
      success: true,
      message: '权限删除成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [权限API] 删除权限失败:', error)
    return NextResponse.json(
      { success: false, error: '删除权限失败' },
      { status: 500 }
    )
  }
}
