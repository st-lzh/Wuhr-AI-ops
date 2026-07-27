import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, invalidateUserAuthCache } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { SYSTEM_PERMISSIONS } from '../../../../lib/auth/permissions'

const ROLE_NAMES = ['admin', 'manager', 'developer', 'viewer'] as const

const UpdateRoleSchema = z.object({
  name: z.enum(ROLE_NAMES),
  displayName: z.string().min(2).max(100),
  description: z.string().min(2).max(1000),
  permissions: z.array(z.string()).max(100)
})

function canReadRoles(user: any) {
  return user.role === 'admin' || user.permissions?.includes('*') || user.permissions?.includes('permissions:read')
}

function canWriteRoles(user: any) {
  return user.role === 'admin' || user.permissions?.includes('*') || user.permissions?.includes('permissions:write')
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    if (!canReadRoles(authResult.user)) {
      return NextResponse.json({ success: false, error: '没有角色查看权限' }, { status: 403 })
    }
    const prisma = await getPrismaClient()
    const [roles, userCounts] = await Promise.all([
      prisma.role.findMany({ orderBy: { name: 'asc' } }),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } })
    ])
    const countMap = new Map(userCounts.map(item => [item.role, item._count._all]))
    return NextResponse.json({
      success: true,
      data: {
        roles: roles.map(role => ({ ...role, userCount: countMap.get(role.name) || 0 })),
        permissions: SYSTEM_PERMISSIONS.map(({ id, name, code, description, category }) => ({ id, name, code, description, category }))
      }
    })
  } catch (error) {
    console.error('获取角色列表失败:', error)
    return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 })
  }
}

async function updateRole(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    if (!canWriteRoles(authResult.user)) {
      return NextResponse.json({ success: false, error: '没有角色修改权限' }, { status: 403 })
    }
    const parsed = UpdateRoleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: '角色参数无效', details: parsed.error.errors }, { status: 400 })
    }
    const prisma = await getPrismaClient()
    const validCodes = new Set(SYSTEM_PERMISSIONS.map(item => item.code))
    const requested = Array.from(new Set(parsed.data.permissions))
    const invalid = requested.filter(code => code !== '*' && !validCodes.has(code))
    if (invalid.length > 0) {
      return NextResponse.json({ success: false, error: `包含无效权限：${invalid.join(', ')}` }, { status: 400 })
    }
    const permissions = parsed.data.name === 'admin' ? ['*'] : requested.filter(code => code !== '*')
    const affectedUsers = await prisma.user.findMany({ where: { role: parsed.data.name }, select: { id: true } })
    const [role] = await prisma.$transaction([
      prisma.role.upsert({
        where: { name: parsed.data.name },
        update: { displayName: parsed.data.displayName, description: parsed.data.description, permissions },
        create: { name: parsed.data.name, displayName: parsed.data.displayName, description: parsed.data.description, permissions }
      }),
      prisma.user.updateMany({ where: { role: parsed.data.name }, data: { permissions } }),
      prisma.systemLog.create({
        data: {
          level: 'info',
          category: 'role_management',
          source: 'admin-roles',
          userId: authResult.user.id,
          message: `更新角色权限：${parsed.data.displayName}`,
          details: { action: 'role_update', role: parsed.data.name, permissions, affectedUsers: affectedUsers.length }
        }
      })
    ])
    affectedUsers.forEach(user => invalidateUserAuthCache(user.id))
    return NextResponse.json({ success: true, data: { ...role, userCount: affectedUsers.length }, message: '角色及现有用户权限已同步更新' })
  } catch (error) {
    console.error('更新角色失败:', error)
    return NextResponse.json({ success: false, error: '更新角色失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) { return updateRole(request) }
export async function PUT(request: NextRequest) { return updateRole(request) }
