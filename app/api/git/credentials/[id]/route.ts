import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { canWriteTeamAssets } from '../../../../../lib/auth/teamAccess'

// 获取单个Git认证配置详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const { id } = params
    const prisma = await getPrismaClient()

    console.log('🔍 获取Git认证配置详情:', { userId: user.id, credentialId: id })

    const credential = await prisma.gitCredential.findFirst({
      where: {
        id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        platform: true,
        authType: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!credential) {
      return NextResponse.json({
        success: false,
        error: '认证配置不存在'
      }, { status: 404 })
    }

    console.log('✅ 获取Git认证配置详情成功')

    return NextResponse.json({
      success: true,
      data: credential
    })

  } catch (error) {
    console.error('❌ 获取Git认证配置详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取认证配置详情失败'
    }, { status: 500 })
  }
}

// 删除Git认证配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return NextResponse.json({ success: false, error: '没有接入凭据写入权限' }, { status: 403 })
    }
    const { id } = params
    const prisma = getPrismaClient()

    console.log('🗑️ 删除Git认证配置:', { userId: user.id, credentialId: id })

    // 检查认证配置是否存在
    const credential = await (await prisma).gitCredential.findFirst({
      where: {
        id,
        isActive: true
      }
    })

    if (!credential) {
      return NextResponse.json({
        success: false,
        error: '认证配置不存在'
      }, { status: 404 })
    }

    // 软删除（设置为非活跃状态）
    await (await prisma).gitCredential.update({
      where: { id },
      data: { isActive: false }
    })

    console.log('✅ Git认证配置删除成功')

    return NextResponse.json({
      success: true,
      message: '认证配置删除成功'
    })

  } catch (error) {
    console.error('❌ 删除Git认证配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除认证配置失败'
    }, { status: 500 })
  }
}

// 设置为默认认证配置
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return NextResponse.json({ success: false, error: '没有接入凭据写入权限' }, { status: 403 })
    }
    const { id } = params
    const body = await request.json()
    const { isDefault } = body

    const prisma = getPrismaClient()

    console.log('🔄 更新Git认证配置:', { userId: user.id, credentialId: id, isDefault })

    // 检查认证配置是否存在
    const credential = await (await prisma).gitCredential.findFirst({
      where: {
        id,
        isActive: true
      }
    })

    if (!credential) {
      return NextResponse.json({
        success: false,
        error: '认证配置不存在'
      }, { status: 404 })
    }

    // 如果设置为默认，先取消同平台的其他默认配置
    if (isDefault) {
      await (await prisma).gitCredential.updateMany({
        where: {
          platform: credential.platform,
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    // 更新当前配置
    const updatedCredential = await (await prisma).gitCredential.update({
      where: { id },
      data: { isDefault },
      select: {
        id: true,
        name: true,
        platform: true,
        authType: true,
        isDefault: true,
        updatedAt: true
      }
    })

    console.log('✅ Git认证配置更新成功')

    return NextResponse.json({
      success: true,
      data: updatedCredential,
      message: '认证配置更新成功'
    })

  } catch (error) {
    console.error('❌ 更新Git认证配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新认证配置失败'
    }, { status: 500 })
  }
}
