import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

// ELK配置接口
interface ELKConfig {
  kibanaUrl: string
  elasticsearchUrl: string
  defaultIndex: string
  enabled: boolean
}

// 获取ELK配置
export async function GET(request: NextRequest) {
  try {
    // 权限检查 - 需要配置读取权限
    const authResult = await requirePermission(request, 'config:read')
    if (!authResult || !authResult.success) {
      return authResult?.response || NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      )
    }

    const prisma = await getPrismaClient()

    // 获取ELK配置
    const elkConfig = await prisma.systemConfig.findUnique({
      where: {
        key: 'elk_config'
      }
    })

    // 如果没有配置，返回默认值
    if (!elkConfig) {
      const defaultConfig: ELKConfig = {
        kibanaUrl: 'http://localhost:5601',
        elasticsearchUrl: 'http://localhost:9200',
        defaultIndex: 'logstash-*',
        enabled: false
      }

      return NextResponse.json({
        success: true,
        data: defaultConfig
      })
    }

    return NextResponse.json({
      success: true,
      data: elkConfig.value as unknown as ELKConfig
    })

  } catch (error) {
    console.error('获取ELK配置失败:', error)
    return NextResponse.json(
      { error: '获取ELK配置失败' },
      { status: 500 }
    )
  }
}

// 保存ELK配置
export async function POST(request: NextRequest) {
  try {
    // 权限检查 - 需要配置写入权限
    const authResult = await requirePermission(request, 'config:write')
    if (!authResult || !authResult.success) {
      return authResult?.response || NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      )
    }

    const prisma = await getPrismaClient()

    // 解析请求体
    const body = await request.json()
    console.log('🔄 接收到ELK配置保存请求:', body)
    const { kibanaUrl, elasticsearchUrl, defaultIndex, enabled } = body
    console.log('🔍 解析后的enabled字段:', enabled)
    console.log('🔍 enabled字段类型:', typeof enabled)

    // 验证必填字段
    if (!kibanaUrl || !elasticsearchUrl || !defaultIndex) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    // 验证URL格式
    try {
      new URL(kibanaUrl)
      new URL(elasticsearchUrl)
    } catch (error) {
      return NextResponse.json(
        { error: 'URL格式不正确' },
        { status: 400 }
      )
    }

    const elkConfig: ELKConfig = {
      kibanaUrl: kibanaUrl.trim(),
      elasticsearchUrl: elasticsearchUrl.trim(),
      defaultIndex: defaultIndex.trim(),
      enabled: Boolean(enabled)
    }
    console.log('🔍 构建的ELK配置对象:', elkConfig)
    console.log('🔍 最终enabled值:', elkConfig.enabled)

    // 保存或更新配置
    const savedConfig = await prisma.systemConfig.upsert({
      where: {
        key: 'elk_config'
      },
      update: {
        value: elkConfig as any,
        updatedAt: new Date()
      },
      create: {
        key: 'elk_config',
        value: elkConfig as any,
        category: 'logging',
        description: 'ELK (Elasticsearch, Logstash, Kibana) 系统配置',
        isPublic: false
      }
    })

    console.log('✅ ELK配置保存成功:', savedConfig.key)
    console.log('🔍 保存到数据库的配置:', savedConfig.value)

    const returnData = savedConfig.value as unknown as ELKConfig
    console.log('🔍 返回给前端的数据:', returnData)

    return NextResponse.json({
      success: true,
      message: 'ELK配置保存成功',
      data: returnData
    })

  } catch (error) {
    console.error('保存ELK配置失败:', error)
    return NextResponse.json(
      { error: '保存ELK配置失败' },
      { status: 500 }
    )
  }
}

// 测试ELK连接
export async function PATCH(request: NextRequest) {
  try {
    // 权限检查 - 需要配置读取权限
    const authResult = await requirePermission(request, 'config:read')
    if (!authResult || !authResult.success) {
      return authResult?.response || NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { kibanaUrl, elasticsearchUrl } = body

    if (!kibanaUrl || !elasticsearchUrl) {
      return NextResponse.json(
        { error: '请提供Kibana和Elasticsearch URL' },
        { status: 400 }
      )
    }

    console.log('🔍 开始测试ELK连接')
    console.log('📋 Kibana URL:', kibanaUrl)
    console.log('📋 Elasticsearch URL:', elasticsearchUrl)

    // 测试Elasticsearch连接
    try {
      const esResponse = await fetch(`${elasticsearchUrl}/_cluster/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5秒超时
      })

      if (!esResponse.ok) {
        throw new Error(`Elasticsearch连接失败: ${esResponse.status}`)
      }

      console.log('✅ Elasticsearch连接成功')
    } catch (error) {
      console.error('❌ Elasticsearch连接失败:', error)

      let errorMessage = 'Elasticsearch连接失败'
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = `无法连接到Elasticsearch服务器 (${elasticsearchUrl})。请检查：\n1. Elasticsearch服务是否正在运行\n2. 服务器地址和端口是否正确\n3. 网络连接是否正常`
        } else if (error.message.includes('timeout')) {
          errorMessage = `连接Elasticsearch超时 (${elasticsearchUrl})。请检查网络连接或服务器响应速度`
        } else {
          errorMessage = `Elasticsearch连接错误: ${error.message}`
        }
      }

      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 400 })
    }

    // 测试Kibana连接
    try {
      const kibanaResponse = await fetch(`${kibanaUrl}/api/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5秒超时
      })

      if (!kibanaResponse.ok) {
        throw new Error(`Kibana连接失败: ${kibanaResponse.status}`)
      }

      console.log('✅ Kibana连接成功')
    } catch (error) {
      console.error('❌ Kibana连接失败:', error)

      let errorMessage = 'Kibana连接失败'
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = `无法连接到Kibana服务器 (${kibanaUrl})。请检查：\n1. Kibana服务是否正在运行\n2. 服务器地址和端口是否正确\n3. 网络连接是否正常`
        } else if (error.message.includes('timeout')) {
          errorMessage = `连接Kibana超时 (${kibanaUrl})。请检查网络连接或服务器响应速度`
        } else {
          errorMessage = `Kibana连接错误: ${error.message}`
        }
      }

      return NextResponse.json({
        success: false,
        error: errorMessage
      }, { status: 400 })
    }

    console.log('✅ ELK连接测试成功')

    return NextResponse.json({
      success: true,
      message: 'ELK系统连接测试成功',
      data: {
        elasticsearch: 'connected',
        kibana: 'connected'
      }
    })

  } catch (error) {
    console.error('ELK连接测试失败:', error)
    return NextResponse.json(
      { error: 'ELK连接测试失败' },
      { status: 500 }
    )
  }
}
