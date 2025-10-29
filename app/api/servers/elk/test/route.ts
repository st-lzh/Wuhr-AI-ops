import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'

// POST - 测试ELK连接
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const data = await request.json()
    const { host, port, username, password, ssl, apiKey, indices } = data

    if (!host || !port) {
      return NextResponse.json({
        success: false,
        message: '请提供ELK服务器地址和端口'
      }, { status: 400 })
    }

    // 构建Elasticsearch URL
    const protocol = ssl ? 'https' : 'http'
    const baseUrl = `${protocol}://${host}:${port}`

    console.log(`🔍 测试ELK连接: ${baseUrl}`)

    // 准备认证头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (apiKey) {
      headers['Authorization'] = `ApiKey ${apiKey}`
    } else if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    // 测试连接 - 获取集群健康状态
    const healthResponse = await fetch(`${baseUrl}/_cluster/health`, {
      method: 'GET',
      headers
    })

    if (!healthResponse.ok) {
      const errorText = await healthResponse.text()
      console.error(`❌ ELK健康检查失败: ${healthResponse.status} - ${errorText}`)
      
      return NextResponse.json({
        success: false,
        message: `连接失败: HTTP ${healthResponse.status}`,
        details: {
          status: healthResponse.status,
          error: errorText
        }
      })
    }

    const healthData = await healthResponse.json()
    console.log(`✅ ELK集群健康状态:`, healthData)

    // 测试索引访问
    let indexInfo = null
    if (indices && Array.isArray(indices) && indices.length > 0) {
      try {
        // 测试第一个索引模式
        const testIndex = indices[0]
        const indexResponse = await fetch(`${baseUrl}/${testIndex}/_stats`, {
          method: 'GET',
          headers
        })

        if (indexResponse.ok) {
          const indexData = await indexResponse.json()
          const matchedIndices = Object.keys(indexData.indices || {})
          indexInfo = {
            testedPattern: testIndex,
            matchedIndices: matchedIndices.length,
            indices: matchedIndices.slice(0, 5), // 只返回前5个索引名
            totalPatterns: indices.length
          }
          console.log(`✅ 索引访问成功: 模式 ${testIndex} 匹配到 ${matchedIndices.length} 个索引`)
        } else {
          console.warn(`⚠️ 索引访问失败: ${indexResponse.status}`)
        }
      } catch (indexError) {
        console.warn('⚠️ 索引测试失败:', indexError)
      }
    }

    // 测试搜索功能
    let searchTest = null
    try {
      const searchResponse = await fetch(`${baseUrl}/_search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          size: 1,
          query: {
            match_all: {}
          }
        })
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        searchTest = {
          totalHits: searchData.hits?.total?.value || 0,
          took: searchData.took
        }
        console.log(`✅ 搜索测试成功: 总文档数 ${searchTest.totalHits}`)
      }
    } catch (searchError) {
      console.warn('⚠️ 搜索测试失败:', searchError)
    }

    return NextResponse.json({
      success: true,
      message: '连接测试成功',
      details: {
        cluster: {
          name: healthData.cluster_name,
          status: healthData.status,
          nodes: healthData.number_of_nodes,
          dataNodes: healthData.number_of_data_nodes
        },
        index: indexInfo,
        search: searchTest,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('ELK连接测试失败:', error)
    
    let errorMessage = '连接测试失败'
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '连接被拒绝，请检查服务器地址和端口'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = '无法解析主机名，请检查服务器地址'
      } else if (error.message.includes('timeout')) {
        errorMessage = '连接超时，请检查网络连接'
      } else if (error.message.includes('certificate')) {
        errorMessage = 'SSL证书验证失败'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({
      success: false,
      message: errorMessage,
      details: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    })
  }
}
