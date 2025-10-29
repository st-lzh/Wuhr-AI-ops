import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { encrypt, decrypt } from '../../../../../lib/crypto/encryption'

// GET - 获取ELK配置列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const prisma = await getPrismaClient()

    const configs = await prisma.eLKConfig.findMany({
      orderBy: { createdAt: 'desc' }
    })

    // 解密敏感信息（仅返回是否设置了密码，不返回实际密码）
    const safeConfigs = configs.map(config => ({
      id: config.id,
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      hasPassword: !!config.password,
      indices: config.indices, // 支持多索引
      ssl: config.ssl,
      isActive: config.isActive,
      hasApiKey: !!config.apiKey,
      webUrl: config.webUrl, // ELK/Kibana访问链接
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    }))

    return NextResponse.json({
      success: true,
      configs: safeConfigs
    })

  } catch (error) {
    console.error('获取ELK配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取配置时发生错误'
    }, { status: 500 })
  }
}

// POST - 创建ELK配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const data = await request.json()
    const { name, host, port, username, password, indices, ssl, isActive, apiKey, webUrl } = data

    if (!name || !host || !port) {
      return NextResponse.json({
        success: false,
        error: '请填写必要的配置信息（名称、主机、端口）'
      }, { status: 400 })
    }

    // 确保indices是数组，如果为空则表示查询所有索引
    const indexArray = Array.isArray(indices) ? indices : []

    const prisma = await getPrismaClient()

    // 检查是否已存在完全相同的配置（防止重复创建）
    const existingConfig = await prisma.eLKConfig.findFirst({
      where: {
        userId: user.id,
        name: name,
        host: host,
        port: parseInt(port)
      }
    })

    if (existingConfig) {
      console.log(`⚠️ 完全相同的配置已存在: ${name} (${host}:${port})`)
      return NextResponse.json({
        success: false,
        error: `配置"${name}"已存在相同的服务器地址 ${host}:${port}，请使用不同的名称或服务器地址`
      }, { status: 400 })
    }

    // 如果设置为活动配置，先将其他配置设为非活动
    if (isActive) {
      await prisma.eLKConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }

    // 加密敏感信息
    const encryptedPassword = password ? encrypt(password) : null
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null

    const config = await prisma.eLKConfig.create({
      data: {
        name,
        host,
        port: parseInt(port),
        username: username || null,
        password: encryptedPassword,
        indices: indexArray, // 存储索引数组（可以为空）
        ssl: !!ssl,
        isActive: !!isActive,
        apiKey: encryptedApiKey,
        webUrl: webUrl || null, // ELK/Kibana访问链接
        userId: user.id
      }
    })

    console.log(`✅ 创建ELK配置成功: ${name} (${host}:${port})`)

    return NextResponse.json({
      success: true,
      message: 'ELK配置创建成功',
      config: {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        isActive: config.isActive
      }
    })

  } catch (error) {
    console.error('创建ELK配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建配置时发生错误'
    }, { status: 500 })
  }
}

// PUT - 更新ELK配置
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const data = await request.json()
    const { id, name, host, port, username, password, indices, ssl, isActive, apiKey, webUrl } = data

    if (!id || !name || !host || !port) {
      return NextResponse.json({
        success: false,
        error: '请填写必要的配置信息（ID、名称、主机、端口）'
      }, { status: 400 })
    }

    // 确保indices是数组，如果为空则表示查询所有索引
    const indexArray = Array.isArray(indices) ? indices : []

    const prisma = await getPrismaClient()

    // 检查配置是否存在
    const existingConfig = await prisma.eLKConfig.findUnique({
      where: { id }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: '配置不存在'
      }, { status: 404 })
    }

    // 如果设置为活动配置，先将其他配置设为非活动
    if (isActive) {
      await prisma.eLKConfig.updateMany({
        where: { 
          isActive: true,
          id: { not: id }
        },
        data: { isActive: false }
      })
    }

    // 处理密码更新
    let encryptedPassword = existingConfig.password
    if (password && password !== '***') {
      encryptedPassword = encrypt(password)
    } else if (password === '') {
      encryptedPassword = null
    }

    // 处理API密钥更新
    let encryptedApiKey = existingConfig.apiKey
    if (apiKey && apiKey !== '***') {
      encryptedApiKey = encrypt(apiKey)
    } else if (apiKey === '') {
      encryptedApiKey = null
    }

    const config = await prisma.eLKConfig.update({
      where: { id },
      data: {
        name,
        host,
        port: parseInt(port),
        username: username || null,
        password: encryptedPassword,
        indices: indexArray, // 更新索引数组（可以为空）
        ssl: !!ssl,
        isActive: !!isActive,
        apiKey: encryptedApiKey,
        webUrl: webUrl || null, // 更新访问链接
        updatedAt: new Date()
      }
    })

    console.log(`✅ 更新ELK配置成功: ${name} (${host}:${port})`)

    return NextResponse.json({
      success: true,
      message: 'ELK配置更新成功',
      config: {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        isActive: config.isActive
      }
    })

  } catch (error) {
    console.error('更新ELK配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新配置时发生错误'
    }, { status: 500 })
  }
}

// DELETE - 删除ELK配置
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '缺少配置ID'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 检查配置是否存在
    const existingConfig = await prisma.eLKConfig.findUnique({
      where: { id }
    })

    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: '配置不存在'
      }, { status: 404 })
    }

    await prisma.eLKConfig.delete({
      where: { id }
    })

    console.log(`✅ 删除ELK配置成功: ${existingConfig.name}`)

    return NextResponse.json({
      success: true,
      message: 'ELK配置删除成功'
    })

  } catch (error) {
    console.error('删除ELK配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '删除配置时发生错误'
    }, { status: 500 })
  }
}
