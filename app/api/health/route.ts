import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/config/database'

export async function GET(request: NextRequest) {
  try {
    // 检查数据库连接
    const prisma = await getPrismaClient()
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        application: 'running'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    }, { status: 503 })
  }
}
