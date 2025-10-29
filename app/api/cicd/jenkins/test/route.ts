import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'

// Jenkins连接测试API（不需要保存配置）
export async function POST(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    const { name, serverUrl, username, apiToken, isActive } = body

    console.log('🔧 测试Jenkins连接配置:', {
      name,
      serverUrl,
      username: username ? '***' : '未设置',
      apiToken: apiToken ? '***' : '未设置',
      isActive
    })

    // 验证必填字段
    if (!serverUrl) {
      return NextResponse.json({
        success: false,
        message: '请输入Jenkins服务器地址'
      }, { status: 400 })
    }

    if (!username) {
      return NextResponse.json({
        success: false,
        message: '请输入Jenkins用户名'
      }, { status: 400 })
    }

    if (!apiToken) {
      return NextResponse.json({
        success: false,
        message: '请输入Jenkins API Token'
      }, { status: 400 })
    }

    // 测试Jenkins连接
    try {
      console.log(`🔗 开始测试Jenkins连接: ${serverUrl}`)

      // 构建认证头
      const auth = Buffer.from(`${username}:${apiToken}`).toString('base64')

      // 测试Jenkins API连接
      const testResponse = await fetch(`${serverUrl}/api/json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Wuhr-AI-Ops/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      })

      if (!testResponse.ok) {
        console.error(`❌ Jenkins连接失败: ${testResponse.status} ${testResponse.statusText}`)
        
        let errorMessage = 'Jenkins连接失败'
        if (testResponse.status === 401) {
          errorMessage = '认证失败，请检查用户名和API Token是否正确'
        } else if (testResponse.status === 403) {
          errorMessage = '权限不足，请检查用户是否有访问Jenkins API的权限'
        } else if (testResponse.status === 404) {
          errorMessage = 'Jenkins服务器不存在或URL错误，请检查服务器地址'
        } else {
          errorMessage = `连接失败: HTTP ${testResponse.status} ${testResponse.statusText}`
        }

        return NextResponse.json({
          success: false,
          message: errorMessage,
          details: {
            status: testResponse.status,
            statusText: testResponse.statusText,
            url: serverUrl
          }
        }, { status: 400 })
      }

      // 解析Jenkins信息
      const jenkinsInfo = await testResponse.json()
      console.log('✅ Jenkins连接成功:', {
        version: jenkinsInfo.version,
        mode: jenkinsInfo.mode,
        nodeDescription: jenkinsInfo.nodeDescription
      })

      return NextResponse.json({
        success: true,
        message: 'Jenkins连接测试成功',
        data: {
          jenkins: {
            name: name || 'Jenkins服务器',
            url: serverUrl,
            version: jenkinsInfo.version || '未知',
            mode: jenkinsInfo.mode || '未知',
            jobCount: jenkinsInfo.jobs?.length || 0,
            nodeDescription: jenkinsInfo.nodeDescription || '未知',
            useCrumbs: jenkinsInfo.useCrumbs || false
          },
          testResult: {
            status: 'success',
            responseTime: Date.now(),
            timestamp: new Date().toISOString()
          }
        }
      })

    } catch (connectionError: any) {
      console.error(`❌ Jenkins连接异常:`, connectionError)
      
      let errorMessage = 'Jenkins连接异常'
      if (connectionError.code === 'ECONNREFUSED') {
        errorMessage = '连接被拒绝，请检查Jenkins服务器是否正在运行'
      } else if (connectionError.code === 'ENOTFOUND') {
        errorMessage = '无法解析主机名，请检查服务器URL是否正确'
      } else if (connectionError.code === 'ETIMEDOUT') {
        errorMessage = '连接超时，请检查网络连接和防火墙设置'
      } else if (connectionError.name === 'AbortError') {
        errorMessage = '请求超时，Jenkins服务器响应缓慢'
      } else if (connectionError.message) {
        errorMessage = `连接错误: ${connectionError.message}`
      }

      return NextResponse.json({
        success: false,
        message: errorMessage,
        details: {
          code: connectionError.code,
          message: connectionError.message,
          url: serverUrl
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Jenkins测试连接API异常:', error)
    return NextResponse.json({
      success: false,
      message: '测试连接时发生内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
