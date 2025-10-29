import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { decrypt } from '../../../../lib/crypto/encryption'

// GET - 获取Grafana仪表板列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const { searchParams } = new URL(request.url)
    const configId = searchParams.get('configId')

    if (!configId) {
      return NextResponse.json({
        success: false,
        error: '请提供Grafana配置ID'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 获取Grafana配置
    const config = await prisma.grafanaConfig.findFirst({
      where: {
        id: configId,
        userId: user.id
      }
    })

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Grafana配置不存在或无权限访问'
      }, { status: 404 })
    }

    const baseUrl = `${config.protocol}://${config.host}:${config.port}`
    
    // 构建认证头
    let authHeaders: Record<string, string> = {}
    
    if (config.apiKey) {
      const decryptedApiKey = decrypt(config.apiKey)
      authHeaders['Authorization'] = `Bearer ${decryptedApiKey}`
    } else if (config.username && config.password) {
      const decryptedPassword = decrypt(config.password)
      const credentials = Buffer.from(`${config.username}:${decryptedPassword}`).toString('base64')
      authHeaders['Authorization'] = `Basic ${credentials}`
    }

    console.log(`🔍 获取Grafana仪表板列表: ${baseUrl}`)

    // 搜索仪表板
    const searchResponse = await fetch(`${baseUrl}/api/search?type=dash-db`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!searchResponse.ok) {
      console.log(`❌ 获取仪表板列表失败: ${searchResponse.status}`)
      return NextResponse.json({
        success: false,
        error: `获取仪表板失败: HTTP ${searchResponse.status}`,
        details: await searchResponse.text()
      }, { status: 400 })
    }

    const dashboards = await searchResponse.json()
    console.log(`✅ 获取仪表板列表成功: ${dashboards.length} 个仪表板`)

    // 获取文件夹信息
    const foldersResponse = await fetch(`${baseUrl}/api/folders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      signal: AbortSignal.timeout(10000)
    })

    let folders = []
    if (foldersResponse.ok) {
      folders = await foldersResponse.json()
      console.log(`✅ 获取文件夹列表成功: ${folders.length} 个文件夹`)
    }

    // 处理仪表板数据，添加文件夹信息
    const processedDashboards = dashboards.map((dashboard: any) => {
      const folder = folders.find((f: any) => f.id === dashboard.folderId)
      return {
        id: dashboard.id,
        uid: dashboard.uid,
        title: dashboard.title,
        uri: dashboard.uri,
        url: dashboard.url,
        slug: dashboard.slug,
        type: dashboard.type,
        tags: dashboard.tags || [],
        isStarred: dashboard.isStarred || false,
        folderId: dashboard.folderId,
        folderUid: dashboard.folderUid,
        folderTitle: folder ? folder.title : 'General',
        folderUrl: folder ? folder.url : null
      }
    })

    // 按文件夹分组
    const dashboardsByFolder = processedDashboards.reduce((acc: any, dashboard: any) => {
      const folderTitle = dashboard.folderTitle || 'General'
      if (!acc[folderTitle]) {
        acc[folderTitle] = []
      }
      acc[folderTitle].push(dashboard)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        dashboards: processedDashboards,
        dashboardsByFolder,
        folders,
        total: processedDashboards.length,
        folderCount: folders.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('获取Grafana仪表板失败:', error)
    
    let errorMessage = '获取仪表板失败'
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '请求超时，请检查网络连接'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '连接被拒绝，请检查Grafana服务器状态'
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

// POST - 获取特定仪表板详情
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }
    const user = authResult.user

    const body = await request.json()
    const { configId, dashboardUid } = body

    if (!configId || !dashboardUid) {
      return NextResponse.json({
        success: false,
        error: '请提供配置ID和仪表板UID'
      }, { status: 400 })
    }

    const prisma = await getPrismaClient()

    // 获取Grafana配置
    const config = await prisma.grafanaConfig.findFirst({
      where: {
        id: configId,
        userId: user.id
      }
    })

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Grafana配置不存在或无权限访问'
      }, { status: 404 })
    }

    const baseUrl = `${config.protocol}://${config.host}:${config.port}`
    
    // 构建认证头
    let authHeaders: Record<string, string> = {}
    
    if (config.apiKey) {
      const decryptedApiKey = decrypt(config.apiKey)
      authHeaders['Authorization'] = `Bearer ${decryptedApiKey}`
    } else if (config.username && config.password) {
      const decryptedPassword = decrypt(config.password)
      const credentials = Buffer.from(`${config.username}:${decryptedPassword}`).toString('base64')
      authHeaders['Authorization'] = `Basic ${credentials}`
    }

    console.log(`🔍 获取仪表板详情: ${dashboardUid}`)

    // 获取仪表板详情
    const dashboardResponse = await fetch(`${baseUrl}/api/dashboards/uid/${dashboardUid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!dashboardResponse.ok) {
      console.log(`❌ 获取仪表板详情失败: ${dashboardResponse.status}`)
      return NextResponse.json({
        success: false,
        error: `获取仪表板详情失败: HTTP ${dashboardResponse.status}`
      }, { status: 400 })
    }

    const dashboardData = await dashboardResponse.json()
    console.log(`✅ 获取仪表板详情成功: ${dashboardData.dashboard.title}`)

    return NextResponse.json({
      success: true,
      data: {
        dashboard: dashboardData.dashboard,
        meta: dashboardData.meta,
        embedUrl: `${baseUrl}/d/${dashboardUid}/${dashboardData.dashboard.slug}?orgId=${config.orgId}&kiosk=tv&theme=dark`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('获取仪表板详情失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取仪表板详情失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
