import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * 磁盘空间检查和管理工具
 */

export interface DiskSpaceInfo {
  total: number // 总空间（GB）
  used: number // 已使用空间（GB）
  available: number // 可用空间（GB）
  usagePercentage: number // 使用百分比
  path: string // 检查的路径
}

export interface DiskSpaceCheckResult {
  hasEnoughSpace: boolean
  currentSpace: DiskSpaceInfo
  requiredSpaceGB: number
  message: string
}

/**
 * 检查本地磁盘空间
 * @param path 要检查的路径
 * @param requiredSpaceGB 需要的空间大小（GB）
 */
export async function checkLocalDiskSpace(
  path: string, 
  requiredSpaceGB: number = 1
): Promise<DiskSpaceCheckResult> {
  try {
    // 使用df命令检查磁盘空间（适用于Linux/macOS）
    const { stdout } = await execAsync(`df -BG "${path}"`)
    const lines = stdout.trim().split('\n')
    const dataLine = lines[1] || lines[0] // 有时候文件系统名很长会换行
    
    // 解析df输出：Filesystem 1G-blocks Used Available Use% Mounted on
    const parts = dataLine.split(/\s+/)
    const total = parseInt(parts[1]?.replace('G', '') || '0')
    const used = parseInt(parts[2]?.replace('G', '') || '0')
    const available = parseInt(parts[3]?.replace('G', '') || '0')
    const usagePercentage = parseInt(parts[4]?.replace('%', '') || '0')

    const diskInfo: DiskSpaceInfo = {
      total,
      used,
      available,
      usagePercentage,
      path
    }

    const hasEnoughSpace = available >= requiredSpaceGB
    
    return {
      hasEnoughSpace,
      currentSpace: diskInfo,
      requiredSpaceGB,
      message: hasEnoughSpace 
        ? `磁盘空间充足：可用${available}GB，需要${requiredSpaceGB}GB`
        : `磁盘空间不足：可用${available}GB，需要${requiredSpaceGB}GB`
    }
  } catch (error) {
    console.error('磁盘空间检查失败:', error)
    
    // 降级方案：使用Node.js的fs.statfs（如果可用）
    try {
      // @ts-ignore - statfs可能不在所有Node.js版本中可用
      const stats = await fs.statfs?.(path)
      if (stats) {
        const total = Math.round((stats.blocks * stats.bsize) / (1024 ** 3))
        const available = Math.round((stats.bavail * stats.bsize) / (1024 ** 3))
        const used = total - available
        
        const diskInfo: DiskSpaceInfo = {
          total,
          used,
          available,
          usagePercentage: Math.round((used / total) * 100),
          path
        }

        const hasEnoughSpace = available >= requiredSpaceGB
        
        return {
          hasEnoughSpace,
          currentSpace: diskInfo,
          requiredSpaceGB,
          message: hasEnoughSpace 
            ? `磁盘空间充足：可用${available}GB，需要${requiredSpaceGB}GB`
            : `磁盘空间不足：可用${available}GB，需要${requiredSpaceGB}GB`
        }
      }
    } catch (fallbackError) {
      console.warn('降级磁盘空间检查也失败:', fallbackError)
    }
    
    // 最终降级：假设有足够空间但记录警告
    console.warn('无法检查磁盘空间，假设有足够空间')
    return {
      hasEnoughSpace: true,
      currentSpace: {
        total: 0,
        used: 0,
        available: 0,
        usagePercentage: 0,
        path
      },
      requiredSpaceGB,
      message: '无法检查磁盘空间，请手动确认空间充足'
    }
  }
}

/**
 * 检查远程服务器磁盘空间
 * @param sshConfig SSH连接配置
 * @param path 要检查的路径
 * @param requiredSpaceGB 需要的空间大小（GB）
 */
export async function checkRemoteDiskSpace(
  sshConfig: any,
  path: string = '/tmp',
  requiredSpaceGB: number = 1
): Promise<DiskSpaceCheckResult> {
  try {
    // 导入SSH客户端
    const { executeSSHCommand } = await import('../ssh/client')
    
    // 在远程服务器上执行df命令
    const result = await executeSSHCommand(
      sshConfig, 
      `df -BG "${path}" | tail -n 1`
    )
    
    if (!result.success || !result.stdout) {
      throw new Error(result.stderr || '远程磁盘空间检查失败')
    }
    
    // 解析df输出
    const parts = result.stdout.trim().split(/\s+/)
    const total = parseInt(parts[1]?.replace('G', '') || '0')
    const used = parseInt(parts[2]?.replace('G', '') || '0')
    const available = parseInt(parts[3]?.replace('G', '') || '0')
    const usagePercentage = parseInt(parts[4]?.replace('%', '') || '0')

    const diskInfo: DiskSpaceInfo = {
      total,
      used,
      available,
      usagePercentage,
      path
    }

    const hasEnoughSpace = available >= requiredSpaceGB
    
    return {
      hasEnoughSpace,
      currentSpace: diskInfo,
      requiredSpaceGB,
      message: hasEnoughSpace 
        ? `远程磁盘空间充足：可用${available}GB，需要${requiredSpaceGB}GB`
        : `远程磁盘空间不足：可用${available}GB，需要${requiredSpaceGB}GB`
    }
  } catch (error) {
    console.error('远程磁盘空间检查失败:', error)
    
    return {
      hasEnoughSpace: false,
      currentSpace: {
        total: 0,
        used: 0,
        available: 0,
        usagePercentage: 100,
        path
      },
      requiredSpaceGB,
      message: `远程磁盘空间检查失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}

/**
 * 清理过期的临时文件
 * @param tempDir 临时目录路径
 * @param maxAgeHours 文件最大存活时间（小时）
 * @param dryRun 是否只模拟运行（不实际删除）
 */
export async function cleanupTempFiles(
  tempDir: string,
  maxAgeHours: number = 24,
  dryRun: boolean = false
): Promise<{
  success: boolean
  deletedFiles: string[]
  freedSpaceGB: number
  error?: string
}> {
  const deletedFiles: string[] = []
  let freedSpaceGB = 0
  
  try {
    console.log(`开始清理临时文件: ${tempDir}, 保留时间: ${maxAgeHours}小时`)
    
    // 确保临时目录存在
    try {
      await fs.access(tempDir)
    } catch {
      return {
        success: true,
        deletedFiles: [],
        freedSpaceGB: 0
      }
    }
    
    const now = Date.now()
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000
    
    const entries = await fs.readdir(tempDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = `${tempDir}/${entry.name}`
      
      try {
        const stats = await fs.stat(fullPath)
        const age = now - stats.mtime.getTime()
        
        if (age > maxAgeMs) {
          // 计算文件/目录大小
          const sizeBytes = await getDirectorySize(fullPath)
          const sizeGB = sizeBytes / (1024 ** 3)
          
          if (!dryRun) {
            if (entry.isDirectory()) {
              await fs.rm(fullPath, { recursive: true, force: true })
            } else {
              await fs.unlink(fullPath)
            }
          }
          
          deletedFiles.push(fullPath)
          freedSpaceGB += sizeGB
          
          console.log(`${dryRun ? '[模拟]' : ''}清理过期文件: ${fullPath} (${sizeGB.toFixed(2)}GB)`)
        }
      } catch (error) {
        console.warn(`跳过文件清理 ${fullPath}:`, error)
      }
    }
    
    console.log(`临时文件清理完成: 删除${deletedFiles.length}个文件/目录，释放${freedSpaceGB.toFixed(2)}GB空间`)
    
    return {
      success: true,
      deletedFiles,
      freedSpaceGB
    }
  } catch (error) {
    console.error('临时文件清理失败:', error)
    return {
      success: false,
      deletedFiles,
      freedSpaceGB,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 获取目录大小（递归计算）
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const stats = await fs.stat(dirPath)
    
    if (stats.isFile()) {
      return stats.size
    }
    
    if (stats.isDirectory()) {
      const entries = await fs.readdir(dirPath)
      let totalSize = 0
      
      for (const entry of entries) {
        const entryPath = `${dirPath}/${entry}`
        totalSize += await getDirectorySize(entryPath)
      }
      
      return totalSize
    }
    
    return 0
  } catch {
    return 0
  }
}

/**
 * 获取推荐的临时目录路径
 * 优先选择空间较大的目录
 */
export async function getRecommendedTempDir(requiredSpaceGB: number = 1): Promise<string> {
  const candidates = [
    '/tmp',
    '/var/tmp',
    process.env.TMPDIR || '/tmp',
    '/dev/shm', // 内存文件系统，速度快但空间小
  ]
  
  for (const candidate of candidates) {
    try {
      const spaceCheck = await checkLocalDiskSpace(candidate, requiredSpaceGB)
      if (spaceCheck.hasEnoughSpace) {
        console.log(`选择临时目录: ${candidate} (可用${spaceCheck.currentSpace.available}GB)`)
        return candidate
      }
    } catch (error) {
      console.warn(`检查临时目录失败 ${candidate}:`, error)
    }
  }
  
  // 如果所有目录都不满足要求，返回默认的/tmp并记录警告
  console.warn(`所有临时目录空间都不足${requiredSpaceGB}GB，使用默认/tmp目录`)
  return '/tmp'
}

/**
 * 创建带空间检查的安全工作目录
 * @param basePath 基础路径
 * @param dirName 目录名
 * @param requiredSpaceGB 需要的空间
 */
export async function createSafeWorkDir(
  basePath: string,
  dirName: string,
  requiredSpaceGB: number = 1
): Promise<{
  success: boolean
  workDir?: string
  error?: string
  diskInfo?: DiskSpaceInfo
}> {
  try {
    // 检查磁盘空间
    const spaceCheck = await checkLocalDiskSpace(basePath, requiredSpaceGB)
    
    if (!spaceCheck.hasEnoughSpace) {
      // 尝试清理过期文件
      console.log('磁盘空间不足，尝试清理过期临时文件...')
      const cleanupResult = await cleanupTempFiles(basePath, 12) // 清理12小时前的文件
      
      // 再次检查空间
      const recheckResult = await checkLocalDiskSpace(basePath, requiredSpaceGB)
      if (!recheckResult.hasEnoughSpace) {
        return {
          success: false,
          error: `磁盘空间不足: ${recheckResult.message}。已清理${cleanupResult.deletedFiles.length}个过期文件，释放${cleanupResult.freedSpaceGB.toFixed(2)}GB空间，但仍不足以满足需求。`,
          diskInfo: recheckResult.currentSpace
        }
      }
    }
    
    // 创建工作目录
    const workDir = `${basePath}/${dirName}`
    await fs.mkdir(workDir, { recursive: true })
    
    return {
      success: true,
      workDir,
      diskInfo: spaceCheck.currentSpace
    }
  } catch (error) {
    return {
      success: false,
      error: `创建工作目录失败: ${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}