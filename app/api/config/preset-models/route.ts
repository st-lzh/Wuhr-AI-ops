import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'

// 预设模型数据结构
export interface PresetModel {
  id: string
  name: string
  displayName: string
  provider: string
  description: string | null
  contextLength: number | null
  maxTokens: number | null
  supportedFeatures: string[]
  isActive: boolean
  category: string | null
  series: string | null
  sortOrder: number | null
  releaseDate: Date | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

// 分组后的模型数据结构
export interface GroupedPresetModels {
  provider: string
  categories: {
    category: string
    series: {
      series: string
      models: PresetModel[]
    }[]
  }[]
}

// GET - 获取预设模型列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')
    const grouped = searchParams.get('grouped') === 'true'

    const prisma = await getPrismaClient()
    let presetModels = await prisma.presetModel.findMany({
      where: provider ? { provider } : {},
      orderBy: [
        { provider: 'asc' },
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    // 如果需要分组数据
    if (grouped) {
      const groupedData: GroupedPresetModels[] = []

      // 按 provider 分组
      const providerMap = new Map<string, PresetModel[]>()
      presetModels.forEach(model => {
        const models = providerMap.get(model.provider) || []
        models.push(model)
        providerMap.set(model.provider, models)
      })

      // 构建分组数据结构
      providerMap.forEach((models, providerName) => {
        const categoryMap = new Map<string, PresetModel[]>()

        // 按 category 分组
        models.forEach(model => {
          const category = model.category || 'uncategorized'
          const categoryModels = categoryMap.get(category) || []
          categoryModels.push(model)
          categoryMap.set(category, categoryModels)
        })

        const categories = Array.from(categoryMap.entries()).map(([category, categoryModels]) => {
          const seriesMap = new Map<string, PresetModel[]>()

          // 按 series 分组
          categoryModels.forEach(model => {
            const series = model.series || 'default'
            const seriesModels = seriesMap.get(series) || []
            seriesModels.push(model)
            seriesMap.set(series, seriesModels)
          })

          return {
            category,
            series: Array.from(seriesMap.entries()).map(([seriesName, seriesModels]) => ({
              series: seriesName,
              models: seriesModels
            }))
          }
        })

        groupedData.push({
          provider: providerName,
          categories
        })
      })

      return NextResponse.json({
        success: true,
        groupedModels: groupedData
      })
    }

    return NextResponse.json({
      success: true,
      presetModels
    })
  } catch (error) {
    console.error('Error fetching preset models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preset models' },
      { status: 500 }
    )
  }
}

// POST - 创建新的预设模型
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      displayName,
      provider,
      description,
      contextLength,
      maxTokens,
      supportedFeatures
    } = body

    // 验证必填字段
    if (!name || !displayName || !provider) {
      return NextResponse.json(
        { error: 'Name, displayName, and provider are required' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    
    // 检查是否已存在相同的模型名称和提供商组合
    const existingModel = await prisma.presetModel.findFirst({
      where: {
        name,
        provider
      }
    })

    if (existingModel) {
      return NextResponse.json(
        { error: 'A preset model with this name and provider already exists' },
        { status: 409 }
      )
    }

    const presetModel = await prisma.presetModel.create({
      data: {
        name,
        displayName,
        provider,
        description: description || '',
        contextLength: contextLength || null,
        maxTokens: maxTokens || null,
        supportedFeatures: supportedFeatures || [],
        isActive: true
      }
    })

    return NextResponse.json({ 
      success: true, 
      presetModel 
    })
  } catch (error) {
    console.error('Error creating preset model:', error)
    return NextResponse.json(
      { error: 'Failed to create preset model' },
      { status: 500 }
    )
  }
}

// PUT - 更新预设模型
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      id,
      name,
      displayName,
      provider,
      description,
      contextLength,
      maxTokens,
      supportedFeatures,
      isActive
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Preset model ID is required' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    const presetModel = await prisma.presetModel.update({
      where: { id },
      data: {
        name,
        displayName,
        provider,
        description,
        contextLength,
        maxTokens,
        supportedFeatures,
        isActive,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true, 
      presetModel 
    })
  } catch (error) {
    console.error('Error updating preset model:', error)
    return NextResponse.json(
      { error: 'Failed to update preset model' },
      { status: 500 }
    )
  }
}

// DELETE - 删除预设模型
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Preset model ID is required' },
        { status: 400 }
      )
    }

    const prisma = await getPrismaClient()
    await prisma.presetModel.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Preset model deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting preset model:', error)
    return NextResponse.json(
      { error: 'Failed to delete preset model' },
      { status: 500 }
    )
  }
}
