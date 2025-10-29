import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../../lib/config/database'

// Jenkins连接测试API
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const jenkinsId = params.id

    console.log(`🔧 测试Jenkins连接: ${jenkinsId}`)

    const prisma = await getPrismaClient()

    // 获取Jenkins配置
    const jenkins = await prisma.jenkinsConfig.findUnique({
      where: { id: jenkinsId },
      select: {
        id: true,
        name: true,
        serverUrl: true,
        username: true,
        apiToken: true,
        isActive: true
      }
    })

    if (!jenkins) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在'
      }, { status: 404 })
    }

    if (!jenkins.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置已禁用'
      }, { status: 400 })
    }

    // 测试Jenkins连接
    try {
      console.log(`🔗 开始测试Jenkins连接: ${jenkins.serverUrl}`)

      // 构建认证头
      const auth = Buffer.from(`${jenkins.username}:${jenkins.apiToken}`).toString('base64')

      // 测试Jenkins API连接
      const testResponse = await fetch(`${jenkins.serverUrl}/api/json`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      })

      if (!testResponse.ok) {
        console.error(`❌ Jenkins连接失败: ${testResponse.status} ${testResponse.statusText}`)
        
        let errorMessage = 'Jenkins连接失败'
        if (testResponse.status === 401) {
          errorMessage = '认证失败，请检查用户名和Token'
        } else if (testResponse.status === 403) {
          errorMessage = '权限不足，请检查用户权限'
        } else if (testResponse.status === 404) {
          errorMessage = 'Jenkins服务器不存在或URL错误'
        } else {
          errorMessage = `连接失败: ${testResponse.status} ${testResponse.statusText}`
        }

        return NextResponse.json({
          success: false,
          error: errorMessage,
          details: {
            status: testResponse.status,
            statusText: testResponse.statusText,
            url: jenkins.serverUrl
          }
        }, { status: 400 })
      }

      // 解析响应数据
      const jenkinsInfo = await testResponse.json()
      
      console.log(`✅ Jenkins连接成功: ${jenkins.name}`)
      console.log(`   版本: ${jenkinsInfo.version || '未知'}`)
      console.log(`   模式: ${jenkinsInfo.mode || '未知'}`)
      console.log(`   任务数量: ${jenkinsInfo.jobs?.length || 0}`)

      // 更新最后测试时间
      await prisma.jenkinsConfig.update({
        where: { id: jenkinsId },
        data: {
          lastTestAt: new Date(),
          testStatus: 'connected',
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Jenkins连接测试成功',
        data: {
          jenkins: {
            id: jenkins.id,
            name: jenkins.name,
            url: jenkins.serverUrl,
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

    } catch (connectionError) {
      console.error(`❌ Jenkins连接异常:`, connectionError)
      
      let errorMessage = 'Jenkins连接异常'
      const error = connectionError as any
      if (error.code === 'ECONNREFUSED') {
        errorMessage = '连接被拒绝，请检查Jenkins服务器是否运行'
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = '无法解析主机名，请检查URL是否正确'
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = '连接超时，请检查网络连接'
      } else if (error.name === 'AbortError') {
        errorMessage = '请求超时，Jenkins服务器响应缓慢'
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: {
          code: error.code,
          message: error.message,
          url: jenkins.serverUrl
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Jenkins连接测试失败:', error)
    return NextResponse.json({
      success: false,
      error: 'Jenkins连接测试失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 获取Jenkins连接状态
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const jenkinsId = params.id

    console.log(`📊 获取Jenkins连接状态: ${jenkinsId}`)

    const prisma = await getPrismaClient()

    // 获取Jenkins配置和最后测试时间
    const jenkins = await prisma.jenkinsConfig.findUnique({
      where: { id: jenkinsId },
      select: {
        id: true,
        name: true,
        serverUrl: true,
        isActive: true,
        lastTestAt: true,
        testStatus: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!jenkins) {
      return NextResponse.json({
        success: false,
        error: 'Jenkins配置不存在'
      }, { status: 404 })
    }

    // 判断连接状态
    let connectionStatus = jenkins.testStatus || 'unknown'
    let statusMessage = '未测试'

    if (jenkins.lastTestAt) {
      const timeDiff = Date.now() - jenkins.lastTestAt.getTime()
      const minutesDiff = timeDiff / (1000 * 60)

      if (jenkins.testStatus === 'connected' && minutesDiff < 5) {
        connectionStatus = 'connected'
        statusMessage = '连接正常'
      } else if (jenkins.testStatus === 'connected' && minutesDiff < 30) {
        connectionStatus = 'warning'
        statusMessage = '连接可能不稳定'
      } else {
        connectionStatus = 'disconnected'
        statusMessage = '连接已断开或未测试'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        jenkins: {
          id: jenkins.id,
          name: jenkins.name,
          url: jenkins.serverUrl,
          isActive: jenkins.isActive,
          connectionStatus,
          statusMessage,
          lastTestAt: jenkins.lastTestAt,
          testStatus: jenkins.testStatus,
          createdAt: jenkins.createdAt,
          updatedAt: jenkins.updatedAt
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取Jenkins连接状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取Jenkins连接状态失败'
    }, { status: 500 })
  }
}
