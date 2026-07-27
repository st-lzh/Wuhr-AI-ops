import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/apiHelpers-new'
import { hasPermission } from '@/lib/auth/permissions'
import { getPrismaClient } from '@/lib/config/database'
import {
  encryptProviderApiKey,
  maskApiKey,
  normalizeBaseUrl,
  providerTypeFor,
  readProviderApiKey
} from '@/lib/ai/modelProviders'
import { protectSecret } from '@/lib/crypto/encryption'

export const dynamic = 'force-dynamic'

interface ConnectionPayload {
  id?: string
  name?: string
  providerKey?: string
  apiKey?: string
  baseUrl?: string
  modelNames?: string[]
  defaultModelName?: string
  isActive?: boolean
}

function canWrite(user: { permissions: string[]; role?: string }) {
  return user.role === 'admin' || hasPermission(user.permissions, 'config:write')
}

function sanitizeModelNames(values?: string[]) {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean)))
}

function connectionResponse(connection: any) {
  const apiKey = readProviderApiKey(connection)
  return {
    id: connection.id,
    name: connection.name,
    providerKey: connection.providerKey,
    adapter: connection.adapter,
    baseUrl: connection.baseUrl,
    hasApiKey: Boolean(apiKey),
    maskedApiKey: maskApiKey(apiKey),
    isActive: connection.isActive,
    lastTestedAt: connection.lastTestedAt,
    testResult: connection.testResult,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    provider: connection.providerCatalog,
    models: connection.modelConfigs
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const prisma = await getPrismaClient()
    const connections = await prisma.model_providers.findMany({
      where: { category: 'LLM' },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      include: {
        providerCatalog: true,
        modelConfigs: {
          orderBy: [{ isDefault: 'desc' }, { displayName: 'asc' }],
          select: {
            id: true,
            modelName: true,
            displayName: true,
            provider: true,
            description: true,
            isActive: true,
            isDefault: true,
            supportsFunctionCalling: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: connections.map(connectionResponse)
    })
  } catch (error) {
    console.error('获取模型服务连接失败:', error)
    return NextResponse.json({ success: false, error: '获取模型服务连接失败' }, { status: 500 })
  }
}

async function saveConnection(request: NextRequest, isUpdate: boolean) {
  const authResult = await requireAuth(request)
  if (!authResult.success) return authResult.response
  const { user } = authResult
  if (!canWrite(user)) {
    return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
  }

  const payload = await request.json() as ConnectionPayload
  const modelNames = sanitizeModelNames(payload.modelNames)
  if (!payload.name?.trim() || !payload.providerKey || modelNames.length === 0) {
    return NextResponse.json(
      { success: false, error: '连接名称、模型厂商和至少一个模型为必填项' },
      { status: 400 }
    )
  }
  if (modelNames.some(name => name.length > 100)) {
    return NextResponse.json({ success: false, error: '模型 ID 不能超过 100 个字符' }, { status: 400 })
  }

  const prisma = await getPrismaClient()
  const catalog = await prisma.modelProviderCatalog.findFirst({
    where: { id: payload.providerKey, isActive: true },
    include: { presetModels: { where: { isActive: true } } }
  })
  if (!catalog) {
    return NextResponse.json({ success: false, error: '模型厂商不存在或已停用' }, { status: 404 })
  }

  const existing = isUpdate && payload.id
    ? await prisma.model_providers.findFirst({
        where: { id: payload.id, category: 'LLM' },
        include: { modelConfigs: true }
      })
    : null
  if (isUpdate && !existing) {
    return NextResponse.json({ success: false, error: '模型服务连接不存在' }, { status: 404 })
  }

  const apiKey = payload.apiKey?.trim() || (existing ? readProviderApiKey(existing) : '')
  if (catalog.apiKeyRequired && !apiKey) {
    return NextResponse.json({ success: false, error: `${catalog.displayName} 需要 API Key` }, { status: 400 })
  }

  const requestedBaseUrl = normalizeBaseUrl(payload.baseUrl)
  const baseUrl = catalog.baseUrlEditable
    ? requestedBaseUrl || normalizeBaseUrl(catalog.defaultBaseUrl)
    : normalizeBaseUrl(catalog.defaultBaseUrl)
  if (!baseUrl) {
    return NextResponse.json({ success: false, error: '该连接需要 Base URL' }, { status: 400 })
  }

  const requestedDefaultModelName = modelNames.includes(payload.defaultModelName || '')
    ? payload.defaultModelName!
    : null
  const existingDefaultModelName = existing?.modelConfigs.find(model => model.isDefault)?.modelName
  const preservedDefaultModelName = existingDefaultModelName && modelNames.includes(existingDefaultModelName)
    ? existingDefaultModelName
    : null
  const presetMap = new Map(catalog.presetModels.map(model => [model.name, model]))
  const connectionId = existing?.id || `model_${randomUUID()}`

  await prisma.$transaction(async tx => {
    if (existing) {
      await tx.model_providers.update({
        where: { id: connectionId },
        data: {
          name: payload.name!.trim(),
          providerKey: catalog.id,
          adapter: catalog.adapter,
          type: providerTypeFor(catalog.id, catalog.adapter) as any,
          baseUrl,
          apiKey: encryptProviderApiKey(apiKey),
          config: { credentialsEncrypted: true, managedBy: 'model-management' },
          isActive: payload.isActive !== false,
          updatedAt: new Date()
        }
      })
    } else {
      await tx.model_providers.create({
        data: {
          id: connectionId,
          userId: user.id,
          name: payload.name!.trim(),
          type: providerTypeFor(catalog.id, catalog.adapter) as any,
          category: 'LLM',
          providerKey: catalog.id,
          adapter: catalog.adapter,
          baseUrl,
          apiKey: encryptProviderApiKey(apiKey),
          config: { credentialsEncrypted: true, managedBy: 'model-management' },
          isDefault: false,
          isActive: payload.isActive !== false,
          updatedAt: new Date()
        }
      })
    }

    await tx.modelConfig.deleteMany({
      where: { providerConnectionId: connectionId, modelName: { notIn: modelNames } }
    })

    for (const modelName of modelNames) {
      const preset = presetMap.get(modelName)
      await tx.modelConfig.upsert({
        where: {
          providerConnectionId_modelName: { providerConnectionId: connectionId, modelName }
        },
        update: {
          displayName: preset?.displayName || modelName,
          provider: catalog.adapter,
          apiKey: protectSecret(apiKey) || '',
          baseUrl,
          description: preset?.description,
          isActive: payload.isActive !== false,
          updatedAt: new Date()
        },
        create: {
          userId: existing?.userId || user.id,
          providerConnectionId: connectionId,
          modelName,
          displayName: preset?.displayName || modelName,
          provider: catalog.adapter,
          apiKey: protectSecret(apiKey) || '',
          baseUrl,
          description: preset?.description,
          isActive: payload.isActive !== false,
          isDefault: false
        }
      })
    }

    let defaultModelName = requestedDefaultModelName || preservedDefaultModelName
    if (!defaultModelName) {
      const currentDefault = await tx.modelConfig.findFirst({
        where: { isDefault: true },
        select: { id: true }
      })
      if (!currentDefault) defaultModelName = modelNames[0]
    }

    if (defaultModelName) {
      await tx.modelConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      await tx.modelConfig.update({
        where: {
          providerConnectionId_modelName: { providerConnectionId: connectionId, modelName: defaultModelName }
        },
        data: { isDefault: true }
      })
      await tx.model_providers.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      await tx.model_providers.update({ where: { id: connectionId }, data: { isDefault: true } })
    } else {
      await tx.model_providers.update({ where: { id: connectionId }, data: { isDefault: false } })
    }
  })

  return NextResponse.json({
    success: true,
    message: isUpdate ? '模型服务连接已更新' : '模型服务连接已创建',
    data: { id: connectionId }
  })
}

export async function POST(request: NextRequest) {
  try {
    return await saveConnection(request, false)
  } catch (error) {
    console.error('创建模型服务连接失败:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await saveConnection(request, true)
  } catch (error) {
    console.error('更新模型服务连接失败:', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '更新失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response
    const { user } = authResult
    if (!canWrite(user)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: '缺少连接 ID' }, { status: 400 })

    const prisma = await getPrismaClient()
    const connection = await prisma.model_providers.findFirst({
      where: { id, category: 'LLM' },
      include: { modelConfigs: { select: { isDefault: true } } }
    })
    if (!connection) return NextResponse.json({ success: false, error: '连接不存在' }, { status: 404 })

    const removedDefault = connection.modelConfigs.some(model => model.isDefault)
    await prisma.$transaction(async tx => {
      await tx.model_providers.delete({ where: { id } })
      if (removedDefault) {
        const replacement = await tx.modelConfig.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        })
        if (replacement) {
          await tx.modelConfig.update({ where: { id: replacement.id }, data: { isDefault: true } })
          if (replacement.providerConnectionId) {
            await tx.model_providers.update({
              where: { id: replacement.providerConnectionId },
              data: { isDefault: true }
            })
          }
        }
      }
    })

    return NextResponse.json({ success: true, message: '模型服务连接已删除' })
  } catch (error) {
    console.error('删除模型服务连接失败:', error)
    return NextResponse.json({ success: false, error: '删除失败；该连接可能仍被其他功能引用' }, { status: 500 })
  }
}
