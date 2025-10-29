import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '../../../../utils/auth'
import RedisChatHistoryManager from '../../../../utils/redisChatHistory'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { sessionId } = params
    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 获取会话信息
    const session = await redisManager.getSession(user.id, sessionId)
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    // 获取会话消息
    const messages = await redisManager.getMessages(user.id, sessionId)
    
    console.log(`📖 获取Redis会话详情: { userId: '${user.id}', sessionId: '${sessionId}', messageCount: ${messages.length} }`)
    
    return NextResponse.json({ session, messages })
  } catch (error) {
    console.error('获取Redis会话详情失败:', error)
    return NextResponse.json(
      { error: '获取会话详情失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { sessionId } = params
    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 检查会话是否存在
    const session = await redisManager.getSession(user.id, sessionId)
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    // 删除会话
    await redisManager.deleteSession(user.id, sessionId)
    
    console.log(`🗑️ 删除Redis会话: { userId: '${user.id}', sessionId: '${sessionId}' }`)
    
    return NextResponse.json({ message: '会话已删除' })
  } catch (error) {
    console.error('删除Redis会话失败:', error)
    return NextResponse.json(
      { error: '删除会话失败' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // 验证用户身份
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { sessionId } = params
    const { message } = await request.json()
    
    const redisManager = RedisChatHistoryManager.getInstance()
    
    // 健康检查
    const isHealthy = await redisManager.healthCheck()
    if (!isHealthy) {
      return NextResponse.json({ error: 'Redis服务不可用' }, { status: 503 })
    }

    // 检查会话是否存在
    const session = await redisManager.getSession(user.id, sessionId)
    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    // 添加消息到会话
    await redisManager.addMessage(user.id, sessionId, message)
    
    console.log(`💬 添加Redis消息: { userId: '${user.id}', sessionId: '${sessionId}', role: '${message.role}' }`)
    
    return NextResponse.json({ message: '消息已添加' })
  } catch (error) {
    console.error('添加Redis消息失败:', error)
    return NextResponse.json(
      { error: '添加消息失败' },
      { status: 500 }
    )
  }
}
