import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { decrypt } from '../../../../../lib/crypto/encryption'

// 提取索引模式的函数
function extractIndexPattern(indexName: string): string {
  // 1. 移除常见的日期格式
  const datePatterns = [
    /^(.+)-\d{4}\.\d{2}\.\d{2}.*$/, // YYYY.MM.DD格式: app-2025.01.01
    /^(.+)-\d{4}-\d{2}-\d{2}.*$/, // YYYY-MM-DD格式: app-2025-01-01
    /^(.+)-\d{8}.*$/, // YYYYMMDD格式: app-20250101
    /^(.+)\.\d{4}\.\d{2}\.\d{2}.*$/, // .YYYY.MM.DD格式: app.2025.01.01
    /^(.+)\.\d{4}-\d{2}-\d{2}.*$/, // .YYYY-MM-DD格式: app.2025-01-01
    /^(.+)\.\d{8}.*$/, // .YYYYMMDD格式: app.20250101
    /^(.+)_\d{4}-\d{2}-\d{2}.*$/, // _YYYY-MM-DD格式: app_2025-01-01
    /^(.+)_\d{8}.*$/, // _YYYYMMDD格式: app_20250101
  ]

  for (const regex of datePatterns) {
    const match = indexName.match(regex)
    if (match) {
      return match[1] + '*'
    }
  }

  // 2. 移除数字后缀
  const numberSuffixPatterns = [
    /^(.+)-\d+$/, // app-123
    /^(.+)\.\d+$/, // app.123
    /^(.+)_\d+$/, // app_123
  ]

  for (const regex of numberSuffixPatterns) {
    const match = indexName.match(regex)
    if (match) {
      return match[1] + '*'
    }
  }

  // 3. 移除版本号格式
  const versionPatterns = [
    /^(.+)-v\d+(\.\d+)*.*$/, // app-v1.2.3
    /^(.+)\.v\d+(\.\d+)*.*$/, // app.v1.2.3
  ]

  for (const regex of versionPatterns) {
    const match = indexName.match(regex)
    if (match) {
      return match[1] + '*'
    }
  }

  // 4. 如果索引名包含多个部分，尝试找到公共前缀
  const parts = indexName.split(/[-._]/)
  if (parts.length > 1) {
    // 检查最后一部分是否是数字、日期或版本
    const lastPart = parts[parts.length - 1]
    if (/^\d+$/.test(lastPart) || /^\d{4}/.test(lastPart) || /^v\d+/.test(lastPart)) {
      return parts.slice(0, -1).join('-') + '*'
    }
  }

  // 5. 如果没有明显的模式，直接使用索引名（但这种情况应该很少）
  return indexName
}

// POST - 获取ELK服务器的实际索引列表
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const data = await request.json()
    const { configId, host, port, ssl, username, password, apiKey } = data

    let config: any

    if (configId && configId !== 'temp') {
      // 从数据库获取配置
      const prisma = await getPrismaClient()
      config = await prisma.eLKConfig.findUnique({
        where: { id: configId }
      })

      if (!config) {
        return NextResponse.json({
          success: false,
          error: 'ELK配置不存在'
        }, { status: 404 })
      }
    } else {
      // 使用临时配置（用于测试连接）
      config = {
        host,
        port,
        ssl,
        username,
        password,
        apiKey
      }
    }

    // 构建Elasticsearch URL
    const protocol = config.ssl ? 'https' : 'http'
    const baseUrl = `${protocol}://${config.host}:${config.port}`

    console.log(`🔍 获取ELK索引列表: ${baseUrl}`)

    // 准备认证头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      const decryptedApiKey = decrypt(config.apiKey)
      headers['Authorization'] = `ApiKey ${decryptedApiKey}`
    } else if (config.username && config.password) {
      const decryptedPassword = decrypt(config.password)
      const auth = Buffer.from(`${config.username}:${decryptedPassword}`).toString('base64')
      headers['Authorization'] = `Basic ${auth}`
    }

    // 获取所有索引信息
    const indicesResponse = await fetch(`${baseUrl}/_cat/indices?format=json&h=index,status,health,docs.count,store.size`, {
      method: 'GET',
      headers
    })

    if (!indicesResponse.ok) {
      const errorText = await indicesResponse.text()
      console.error(`❌ 获取索引列表失败: ${indicesResponse.status} - ${errorText}`)

      return NextResponse.json({
        success: false,
        error: `获取索引列表失败: HTTP ${indicesResponse.status}`,
        details: errorText
      })
    }

    const indicesData = await indicesResponse.json()
    console.log(`✅ 获取到 ${indicesData.length} 个索引`)

    // 处理索引数据，提取索引模式
    const allIndices = indicesData
      .filter((index: any) => {
        // 过滤掉系统索引（以.开头的）
        return !index.index.startsWith('.')
      })
      .map((index: any) => index.index)

    // 生成索引模式（Data Views）
    const indexPatterns = new Map<string, string[]>() // pattern -> matching indices

    allIndices.forEach((indexName: string) => {
      // 提取索引模式的更智能算法
      let pattern = extractIndexPattern(indexName)

      if (!indexPatterns.has(pattern)) {
        indexPatterns.set(pattern, [])
      }
      indexPatterns.get(pattern)!.push(indexName)
    })



    // 转换为数组并统计每个模式的索引数量
    const indices = Array.from(indexPatterns.entries()).map(([pattern, matchingIndexNames]) => {
      // 计算匹配索引的总文档数和健康状态
      let totalDocs = 0
      let healthCounts = { green: 0, yellow: 0, red: 0 }

      matchingIndexNames.forEach((indexName: string) => {
        const indexData = indicesData.find((idx: any) => idx.index === indexName)
        if (indexData) {
          totalDocs += parseInt(indexData['docs.count'] || '0')
          const health = indexData.health || 'green'
          healthCounts[health as keyof typeof healthCounts]++
        }
      })

      // 确定整体健康状态
      let overallHealth = 'green'
      if (healthCounts.red > 0) {
        overallHealth = 'red'
      } else if (healthCounts.yellow > 0) {
        overallHealth = 'yellow'
      }

      return {
        name: pattern,
        status: 'active',
        health: overallHealth,
        docsCount: totalDocs,
        matchingIndices: matchingIndexNames.length,
        storeSize: '0b' // 索引模式不显示具体大小
      }
    })
    .filter(index => index.matchingIndices > 0) // 只返回有匹配索引的模式
    .sort((a: any, b: any) => {
      // 按匹配索引数量降序排序，然后按名称排序
      if (a.matchingIndices !== b.matchingIndices) {
        return b.matchingIndices - a.matchingIndices
      }
      return a.name.localeCompare(b.name)
    })

    // 获取索引统计信息
    let totalDocs = 0
    let totalSize = '0b'
    
    try {
      const statsResponse = await fetch(`${baseUrl}/_stats`, {
        method: 'GET',
        headers
      })

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        totalDocs = statsData._all?.total?.docs?.count || 0
        
        // 计算总大小（简化处理）
        const totalSizeBytes = statsData._all?.total?.store?.size_in_bytes || 0
        if (totalSizeBytes > 0) {
          if (totalSizeBytes > 1024 * 1024 * 1024) {
            totalSize = `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)}gb`
          } else if (totalSizeBytes > 1024 * 1024) {
            totalSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(2)}mb`
          } else if (totalSizeBytes > 1024) {
            totalSize = `${(totalSizeBytes / 1024).toFixed(2)}kb`
          } else {
            totalSize = `${totalSizeBytes}b`
          }
        }
      }
    } catch (statsError) {
      console.warn('⚠️ 获取统计信息失败:', statsError)
    }

    return NextResponse.json({
      success: true,
      indices,
      summary: {
        totalIndices: indices.length,
        totalDocs,
        totalSize
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('获取ELK索引列表失败:', error)
    
    let errorMessage = '获取索引列表失败'
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '无法连接到ELK服务器'
      } else if (error.message.includes('timeout')) {
        errorMessage = '连接超时'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    })
  }
}
