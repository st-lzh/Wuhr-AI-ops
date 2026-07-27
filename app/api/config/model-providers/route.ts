import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiHelpers-new'
import { getPrismaClient } from '@/lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const prisma = await getPrismaClient()
    const providers = await prisma.modelProviderCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      include: {
        presetModels: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            contextLength: true,
            maxTokens: true,
            supportedFeatures: true,
            category: true,
            tags: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, data: providers })
  } catch (error) {
    console.error('获取模型厂商目录失败:', error)
    return NextResponse.json({ success: false, error: '获取模型厂商目录失败' }, { status: 500 })
  }
}
