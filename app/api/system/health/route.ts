import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import { readFile } from 'fs/promises'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


const execFileAsync = promisify(execFile)

// 获取系统健康状态
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('🔍 获取系统健康状态')

    // 并行获取系统信息
    const [cpuInfo, memoryInfo, diskInfo, networkInfo] = await Promise.all([
      getCPUUsage(),
      getMemoryUsage(),
      getDiskUsage(),
      getNetworkUsage()
    ])

    const systemHealth = {
      cpu: cpuInfo,
      memory: memoryInfo,
      disk: diskInfo,
      network: networkInfo,
      uptime: Math.floor(os.uptime()),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    }

    console.log('✅ 系统健康状态获取成功:', systemHealth)

    return NextResponse.json({
      success: true,
      data: systemHealth
    })

  } catch (error) {
    console.error('❌ 获取系统健康状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取系统健康状态失败'
    }, { status: 500 })
  }
}

// 获取CPU使用率
async function getCPUUsage(): Promise<number> {
  try {
    const sample = () => os.cpus().reduce((acc, cpu) => ({
      idle: acc.idle + cpu.times.idle,
      total: acc.total + Object.values(cpu.times).reduce((sum, value) => sum + value, 0)
    }), { idle: 0, total: 0 })
    const before = sample()
    await new Promise(resolve => setTimeout(resolve, 250))
    const after = sample()
    const total = after.total - before.total
    return total > 0 ? Math.round((1 - (after.idle - before.idle) / total) * 100) : 0
  } catch (error) {
    console.error('获取CPU使用率失败:', error)
    return 0
  }
}

// 获取内存使用率
async function getMemoryUsage(): Promise<number> {
  try {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const usage = (usedMem / totalMem) * 100
    return Math.round(usage)
  } catch (error) {
    console.error('获取内存使用率失败:', error)
    return 0
  }
}

// 获取磁盘使用率
async function getDiskUsage(): Promise<number> {
  try {
    const { stdout } = await execFileAsync('df', ['-Pk', '/'])
    const line = stdout.trim().split('\n').at(-1) || ''
    const usage = Number(line.trim().split(/\s+/)[4]?.replace('%', ''))
    return Number.isFinite(usage) ? usage : 0
  } catch (error) {
    console.error('获取磁盘使用率失败:', error)
    return 0
  }
}

// 获取网络使用率
async function getNetworkUsage(): Promise<number> {
  try {
    if (os.platform() !== 'linux') return 0
    const sample = async () => {
      const content = await readFile('/proc/net/dev', 'utf8')
      return content.split('\n').slice(2).reduce((total, line) => {
        const [name, values] = line.trim().split(':')
        if (!values || name === 'lo') return total
        const fields = values.trim().split(/\s+/).map(Number)
        return total + (fields[0] || 0) + (fields[8] || 0)
      }, 0)
    }
    const before = await sample()
    const startedAt = Date.now()
    await new Promise(resolve => setTimeout(resolve, 250))
    const bytesPerSecond = (await sample() - before) * 1000 / Math.max(Date.now() - startedAt, 1)
    const capacityBitsPerSecond = Number(process.env.NETWORK_CAPACITY_BPS) || 1_000_000_000
    return Math.min(100, Math.round(bytesPerSecond * 8 / capacityBitsPerSecond * 100))
  } catch (error) {
    console.error('获取网络使用率失败:', error)
    return 0
  }
}
