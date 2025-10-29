import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { encrypt, decrypt } from '../../../../lib/crypto/encryption'

// GET - 获取Grafana配置列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const prisma = await getPrismaClient()
    
    const configs = await prisma.grafanaConfig.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        protocol: true,
        username: true,
        orgId: true,
        isActive: true,
        description: true,
        tags: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      configs,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('获取Grafana配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取配置失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST - 创建Grafana配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const body = await request.json()
    const { 
      name, 
      host, 
      port = 3000, 
      protocol = 'http',
      username, 
      password, 
      apiKey,
      orgId = 1,
      isActive = false,
      description,
      tags = []
    } = body

    // 验证必填字段
    if (!name || !host) {
      return NextResponse.json({
        success: false,
        error: '请填写必要的配置信息（名称、主机地址）'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 检查是否已存在相同名称的配置
    const existingConfig = await prisma.grafanaConfig.findFirst({
      where: {
        userId: user.id,
        name: name
      }
    })

    if (existingConfig) {
      return NextResponse.json({
        success: false,
        error: `配置名称"${name}"已存在，请使用不同的名称`
      }, { status: 400 })
    }

    // 如果设置为活跃配置，先将其他配置设为非活跃
    if (isActive) {
      await prisma.grafanaConfig.updateMany({
        where: { 
          userId: user.id,
          isActive: true 
        },
        data: { isActive: false }
      })
    }

    // 加密敏感信息
    const encryptedPassword = password ? encrypt(password) : null
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null

    const config = await prisma.grafanaConfig.create({
      data: {
        name,
        host,
        port: parseInt(port),
        protocol,
        username: username || null,
        password: encryptedPassword,
        apiKey: encryptedApiKey,
        orgId: parseInt(orgId),
        isActive: !!isActive,
        description: description || null,
        tags: Array.isArray(tags) ? tags : [],
        userId: user.id
      }
    })

    console.log(`✅ 创建Grafana配置成功: ${name} (${protocol}://${host}:${port})`)

    return NextResponse.json({
      success: true,
      message: '配置创建成功',
      config: {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        protocol: config.protocol,
        username: config.username,
        orgId: config.orgId,
        isActive: config.isActive,
        description: config.description,
        tags: config.tags
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('创建Grafana配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建配置失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// PUT - 更新Grafana配置
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const body = await request.json()
    const { 
      id,
      name, 
      host, 
      port, 
      protocol,
      username, 
      password, 
      apiKey,
      orgId,
      isActive,
      description,
      tags
    } = body

    if (!id || !name || !host || !port) {
      return NextResponse.json({
        success: false,
        error: '请填写必要的配置信息（ID、名称、主机、端口）'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 检查配置是否存在且属于当前用户
    const existingConfig = await prisma.grafanaConfig.findFirst({
      where: {
        id,
        userId: user.id
      }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: '配置不存在或无权限修改'
      }, { status: 404 })
    }

    // 如果设置为活跃配置，先将其他配置设为非活跃
    if (isActive) {
      await prisma.grafanaConfig.updateMany({
        where: { 
          userId: user.id,
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      })
    }

    // 处理密码和API密钥
    let encryptedPassword = existingConfig.password
    let encryptedApiKey = existingConfig.apiKey

    if (password && password !== '***') {
      encryptedPassword = encrypt(password)
    }

    if (apiKey && apiKey !== '***') {
      encryptedApiKey = encrypt(apiKey)
    }

    const config = await prisma.grafanaConfig.update({
      where: { id },
      data: {
        name,
        host,
        port: parseInt(port),
        protocol,
        username: username || null,
        password: encryptedPassword,
        apiKey: encryptedApiKey,
        orgId: parseInt(orgId),
        isActive: !!isActive,
        description: description || null,
        tags: Array.isArray(tags) ? tags : [],
        updatedAt: new Date()
      }
    })

    console.log(`✅ 更新Grafana配置成功: ${name} (${protocol}://${host}:${port})`)

    return NextResponse.json({
      success: true,
      message: '配置更新成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('更新Grafana配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新配置失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// DELETE - 删除Grafana配置
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('id')

    if (!configId) {
      return NextResponse.json({
        success: false,
        error: '请提供配置ID'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 检查配置是否存在且属于当前用户
    const existingConfig = await prisma.grafanaConfig.findFirst({
      where: {
        id: configId,
        userId: user.id
      }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: '配置不存在或无权限删除'
      }, { status: 404 })
    }

    // 删除配置
    await prisma.grafanaConfig.delete({
      where: { id: configId }
    })

    console.log(`✅ Grafana配置删除成功: ${existingConfig.name} (${configId})`)

    return NextResponse.json({
      success: true,
      message: '配置删除成功',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('删除Grafana配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除配置失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
