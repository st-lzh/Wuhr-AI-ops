import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { decrypt } from '../../../../lib/crypto/encryption'

// POST - 测试Grafana连接
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { 
      host, 
      port = 3000, 
      protocol = 'http',
      username, 
      password, 
      apiKey,
      orgId = 1
    } = body

    if (!host) {
      return NextResponse.json({
        success: false,
        error: '请提供Grafana服务器地址'
      }, { status: 400 })
    }

    const baseUrl = `${protocol}://${host}:${port}`
    
    // 构建认证头
    let authHeaders: Record<string, string> = {}
    
    if (apiKey) {
      // 使用API Key认证
      authHeaders['Authorization'] = `Bearer ${apiKey}`
    } else if (username && password) {
      // 使用基本认证
      const credentials = Buffer.from(`${username}:${password}`).toString('base64')
      authHeaders['Authorization'] = `Basic ${credentials}`
    }

    // 测试连接 - 获取Grafana健康状态
    console.log(`🔍 测试Grafana连接: ${baseUrl}`)
    
    const healthResponse = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      signal: AbortSignal.timeout(10000) // 10秒超时
    })

    if (!healthResponse.ok) {
      console.log(`❌ Grafana健康检查失败: ${healthResponse.status}`)
      return NextResponse.json({
        success: false,
        error: `连接失败: HTTP ${healthResponse.status}`,
        details: `无法连接到Grafana服务器 ${baseUrl}`
      }, { status: 400 })
    }

    const healthData = await healthResponse.json()
    console.log(`✅ Grafana健康检查成功:`, healthData)

    // 获取组织信息（如果有认证）
    let orgInfo = null
    if (authHeaders['Authorization']) {
      try {
        const orgResponse = await fetch(`${baseUrl}/api/org`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          signal: AbortSignal.timeout(5000)
        })

        if (orgResponse.ok) {
          orgInfo = await orgResponse.json()
          console.log(`✅ 获取组织信息成功:`, orgInfo)
        }
      } catch (orgError) {
        console.log(`⚠️ 获取组织信息失败:`, orgError)
      }
    }

    // 获取数据源列表（如果有认证）
    let datasources = []
    if (authHeaders['Authorization']) {
      try {
        const dsResponse = await fetch(`${baseUrl}/api/datasources`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          signal: AbortSignal.timeout(5000)
        })

        if (dsResponse.ok) {
          datasources = await dsResponse.json()
          console.log(`✅ 获取数据源列表成功: ${datasources.length} 个数据源`)
        }
      } catch (dsError) {
        console.log(`⚠️ 获取数据源失败:`, dsError)
      }
    }

    return NextResponse.json({
      success: true,
      message: '连接成功！',
      data: {
        health: healthData,
        organization: orgInfo,
        datasourceCount: datasources.length,
        version: healthData.version || 'Unknown',
        database: healthData.database || 'Unknown'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('测试Grafana连接失败:', error)
    
    let errorMessage = '连接测试失败'
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '连接超时，请检查服务器地址和网络连接'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '连接被拒绝，请检查Grafana服务器是否运行'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = '无法解析主机名，请检查服务器地址'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
