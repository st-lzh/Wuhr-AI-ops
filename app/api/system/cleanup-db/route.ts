import { NextRequest, NextResponse } from 'next/server';
import { cleanupDatabaseConnections } from '../../../../lib/config/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 开始清理数据库连接池...');
    
    // 设置超时处理
    const cleanupPromise = cleanupDatabaseConnections();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('数据库清理超时')), 5000)
    );
    
    await Promise.race([cleanupPromise, timeoutPromise]);
    
    console.log('✅ 数据库连接池清理完成');
    
    return NextResponse.json({
      success: true,
      message: '数据库连接池已清理',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 清理数据库连接池失败:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '清理失败',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}