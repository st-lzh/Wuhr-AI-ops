import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '../../../utils/auth'
import RedisChatHistoryManager from '../../../utils/redisChatHistory'

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 获取用户的所有会话
    const sessions = await redisManager.getSessions(user.id)
    
    console.log(`📋 获取Redis会话列表: { userId: '${user.id}', count: ${sessions.length} }`)
    
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('获取Redis会话列表失败:', error)
    return NextResponse.json(
      { error: '获取会话列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { title } = await request.json()
    
    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 创建新会话
    const session = await redisManager.createSession(user.id, title)
    
    console.log(`🆕 创建Redis会话: { userId: '${user.id}', sessionId: '${session.id}' }`)
    
    return NextResponse.json({ session })
  } catch (error) {
    console.error('创建Redis会话失败:', error)
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 清除所有历史记录
    await redisManager.clearHistory(user.id)
    
    console.log(`🧹 清除Redis历史记录: { userId: '${user.id}' }`)
    
    return NextResponse.json({ message: '历史记录已清除' })
  } catch (error) {
    console.error('清除Redis历史记录失败:', error)
    return NextResponse.json(
      { error: '清除历史记录失败' },
      { status: 500 }
    )
  }
}
