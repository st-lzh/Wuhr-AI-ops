import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    // 尝试获取 Gemini CLI 版本
    const geminiPath = path.join(process.cwd(), '..', 'packages', 'cli', 'dist', 'index.js')
    
    const version = await new Promise<string>((resolve) => {
      const geminiProcess = spawn('node', [geminiPath, '--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      })

      let output = ''
      let errorOutput = ''

      if (geminiProcess.stdout) {
        geminiProcess.stdout.on('data', (data) => {
          output += data.toString()
        })
      }

      if (geminiProcess.stderr) {
        geminiProcess.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })
      }

      geminiProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim() || 'unknown')
        } else {
          resolve('unknown')
        }
      })

      geminiProcess.on('error', () => {
        resolve('unknown')
      })

      // 5秒超时
      setTimeout(() => {
        geminiProcess.kill('SIGTERM')
        resolve('unknown')
      }, 5000)
    })

    return NextResponse.json({
      success: true,
      version,
      service: 'Wuhr AI Ops',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ 获取版本信息失败:', error)
    
    return NextResponse.json({
      success: false,
      version: 'unknown',
      service: 'Wuhr AI Ops',
      error: error.message || '获取版本失败',
      timestamp: new Date().toISOString(),
    })
  }
} 