import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiHelpers-new'
import { getPrismaClient } from '@/lib/config/database'
import { discoverProviderModels, normalizeBaseUrl, readProviderApiKey } from '@/lib/ai/modelProviders'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const prisma = await getPrismaClient()
    const connection = body.id
      ? await prisma.model_providers.findFirst({
          where: { id: body.id, category: 'LLM' },
          include: { providerCatalog: true }
        })
      : null
    const catalog = connection?.providerCatalog || await prisma.modelProviderCatalog.findFirst({
      where: { id: body.providerKey, isActive: true }
    })

    if (!catalog) return NextResponse.json({ success: false, error: '模型厂商不存在' }, { status: 404 })
    if (!catalog.supportsModelDiscovery) {
      return NextResponse.json({ success: false, error: '该厂商不提供标准模型列表接口，请手工输入模型 ID' }, { status: 400 })
    }

    const apiKey = body.apiKey?.trim() || (connection ? readProviderApiKey(connection) : '')
    const baseUrl = catalog.baseUrlEditable
      ? normalizeBaseUrl(body.baseUrl || connection?.baseUrl || catalog.defaultBaseUrl)
      : normalizeBaseUrl(catalog.defaultBaseUrl)
    const models = await discoverProviderModels({
      providerKey: catalog.id,
      adapter: catalog.adapter,
      apiKey,
      baseUrl
    })

    return NextResponse.json({ success: true, data: models })
  } catch (error) {
    console.error('发现厂商模型列表失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '模型发现失败' },
      { status: 400 }
    )
  }
}
