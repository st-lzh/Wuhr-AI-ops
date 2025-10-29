import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import fs from 'fs'

// 强制动态渲染，解决构建时的request.headers问题
export const dynamic = 'force-dynamic'


const execAsync = promisify(exec)

// 获取系统状态信息
export async function GET(request: NextRequest) {
  try {
    // 权限检查
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('📊 获取系统状态信息')

    // 获取系统基本信息
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length
    }

    // 计算内存使用率
    const memoryUsage = Math.round(((systemInfo.totalmem - systemInfo.freemem) / systemInfo.totalmem) * 100)

    // 获取CPU使用率
    let cpuUsage = 0
    try {
      if (systemInfo.platform === 'linux') {
        const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'")
        cpuUsage = Math.round(parseFloat(stdout.trim()) || 0)
      } else {
        // 对于非Linux系统，使用负载平均值估算
        cpuUsage = Math.min(Math.round((systemInfo.loadavg[0] / systemInfo.cpus) * 100), 100)
      }
    } catch (error) {
      console.warn('获取CPU使用率失败，使用负载平均值:', error)
      cpuUsage = Math.min(Math.round((systemInfo.loadavg[0] / systemInfo.cpus) * 100), 100)
    }

    // 获取磁盘使用率
    let diskUsage = 0
    try {
      if (systemInfo.platform === 'linux') {
        const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'")
        diskUsage = parseInt(stdout.trim()) || 0
      } else {
        // 对于非Linux系统，尝试其他方法
        try {
          const stats = fs.statSync('/')
          diskUsage = 50 // 默认值
        } catch {
          diskUsage = 50
        }
      }
    } catch (error) {
      console.warn('获取磁盘使用率失败:', error)
      diskUsage = 50 // 默认值
    }

    // 获取网络状态
    let networkStatus = 'normal'
    let networkConnections = 0
    try {
      if (systemInfo.platform === 'linux') {
        const { stdout } = await execAsync("ss -tuln | wc -l")
        networkConnections = parseInt(stdout.trim()) || 0
      }
    } catch (error) {
      console.warn('获取网络状态失败:', error)
    }

    // 获取进程信息
    let processCount = 0
    try {
      if (systemInfo.platform === 'linux') {
        const { stdout } = await execAsync("ps aux | wc -l")
        processCount = parseInt(stdout.trim()) - 1 || 0 // 减去标题行
      }
    } catch (error) {
      console.warn('获取进程数量失败:', error)
    }

    // 构建响应数据
    const systemStatus = {
      timestamp: new Date().toISOString(),
      system: {
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        hostname: systemInfo.hostname,
        uptime: Math.floor(systemInfo.uptime), // 秒
        cpuCores: systemInfo.cpus
      },
      performance: {
        cpu: {
          usage: cpuUsage,
          loadAverage: systemInfo.loadavg,
          cores: systemInfo.cpus
        },
        memory: {
          total: systemInfo.totalmem,
          free: systemInfo.freemem,
          used: systemInfo.totalmem - systemInfo.freemem,
          usage: memoryUsage
        },
        disk: {
          usage: diskUsage,
          status: diskUsage > 90 ? 'critical' : diskUsage > 75 ? 'warning' : 'normal'
        },
        network: {
          status: networkStatus,
          connections: networkConnections
        }
      },
      processes: {
        total: processCount
      },
      health: {
        overall: getOverallHealth(cpuUsage, memoryUsage, diskUsage),
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage
      }
    }

    console.log('✅ 系统状态获取成功:', {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      uptime: Math.floor(systemInfo.uptime)
    })

    return NextResponse.json({
      success: true,
      data: systemStatus,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ 获取系统状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取系统状态失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// 计算整体健康状态
function getOverallHealth(cpu: number, memory: number, disk: number): 'healthy' | 'warning' | 'critical' {
  if (cpu > 90 || memory > 95 || disk > 95) {
    return 'critical'
  }
  if (cpu > 70 || memory > 85 || disk > 85) {
    return 'warning'
  }
  return 'healthy'
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

// 格式化字节数
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}
