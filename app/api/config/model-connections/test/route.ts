import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiHelpers-new'
import { getPrismaClient } from '@/lib/config/database'
import { normalizeBaseUrl, readProviderApiKey, testProviderConnection } from '@/lib/ai/modelProviders'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const prisma = await getPrismaClient()
    const connection = body.id
      ? await prisma.model_providers.findFirst({
          where: { id: body.id, category: 'LLM' },
          include: { providerCatalog: true, modelConfigs: { where: { isActive: true } } }
        })
      : null
    const catalog = connection?.providerCatalog || await prisma.modelProviderCatalog.findFirst({
      where: { id: body.providerKey, isActive: true }
    })

    if (!catalog) {
      return NextResponse.json({ success: false, error: '模型厂商不存在' }, { status: 404 })
    }

    const apiKey = body.apiKey?.trim() || (connection ? readProviderApiKey(connection) : '')
    const baseUrl = catalog.baseUrlEditable
      ? normalizeBaseUrl(body.baseUrl || connection?.baseUrl || catalog.defaultBaseUrl)
      : normalizeBaseUrl(catalog.defaultBaseUrl)
    const modelName = body.modelName || connection?.modelConfigs?.[0]?.modelName

    const result = await testProviderConnection({
      providerKey: catalog.id,
      adapter: catalog.adapter,
      apiKey,
      baseUrl,
      modelName
    })

    if (connection) {
      await prisma.model_providers.update({
        where: { id: connection.id },
        data: {
          lastTestedAt: new Date(),
          testResult: `success:${result.responseTime}ms`,
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('测试模型服务连接失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '连接测试失败' },
      { status: 400 }
    )
  }
}
