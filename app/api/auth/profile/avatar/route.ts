import { NextRequest, NextResponse } from 'next/server'
import {
  requireAuth,
  successResponse,
  errorResponse,
  serverErrorResponse
} from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 更新用户头像
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const user = authResult.user
    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return errorResponse('请选择头像文件', '未找到上传的文件', 400)
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('文件类型不支持', '仅支持 JPG、PNG、GIF、WebP 格式', 400)
    }

    // 验证文件大小 (最大 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return errorResponse('文件过大', '头像文件大小不能超过 5MB', 400)
    }

    // 创建上传目录
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'avatars')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // 生成文件名
    const fileExtension = file.name.split('.').pop()
    const fileName = `${user.id}_${Date.now()}.${fileExtension}`
    const filePath = join(uploadsDir, fileName)

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 更新数据库中的头像路径
    const prisma = await getPrismaClient()
    const avatarUrl = `/uploads/avatars/${fileName}`
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        avatar: avatarUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true
      }
    })

    return successResponse({
      user: updatedUser,
      avatarUrl: avatarUrl,
      message: '头像更新成功'
    })

  } catch (error) {
    console.error('❌ 头像上传失败:', error)
    return serverErrorResponse(error)
  }
}