import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'
import { RepositoryInfo, ProjectDetectionResult, PROJECT_TEMPLATES } from '../../../../types/project-template'
import { GitOperations } from '../../../../../lib/git/gitOperations'
import { decryptCredentials } from '../../../../../lib/crypto/encryption'

// 仓库验证请求schema
const RepositoryValidationSchema = z.object({
  url: z.string().url('请输入有效的仓库URL'),
  type: z.enum(['git', 'svn']).default('git'),
  credentialId: z.string().optional() // 可选的认证配置ID
})

// 检测Git平台
function detectGitPlatform(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname.includes('github.com')) return 'github'
    if (hostname.includes('gitlab.com')) return 'gitlab'
    if (hostname.includes('gitee.com')) return 'gitee'
    if (hostname.includes('bitbucket.org')) return 'bitbucket'

    return 'other'
  } catch {
    return null
  }
}

// 使用真实的Git操作验证仓库
async function validateGitRepository(
  url: string,
  userId: string,
  credentialId?: string
): Promise<RepositoryInfo> {
  const gitOps = new GitOperations()

  try {
    let credentials = undefined
    let platform = undefined
    let authType = undefined

    // 如果提供了认证配置ID，获取认证信息
    if (credentialId) {
      const prisma = await getPrismaClient()
      const credentialRecord = await prisma.gitCredential.findFirst({
        where: {
          id: credentialId,
          userId,
          isActive: true
        }
      })

      if (credentialRecord) {
        try {
          credentials = decryptCredentials(credentialRecord.encryptedCredentials)
          platform = credentialRecord.platform
          authType = credentialRecord.authType
          console.log('🔐 使用认证配置:', { platform, authType })
        } catch (error) {
          console.error(`❌ 解密认证配置失败 (ID: ${credentialRecord.id}):`, error instanceof Error ? error.message : String(error))
          console.log('💡 跳过无效的认证配置，继续查找其他配置')
          // 解密失败时，将credentials设为null，继续后续逻辑
          credentials = null
        }
      }
    } else {
      // 尝试根据URL自动选择默认认证配置
      const detectedPlatform = detectGitPlatform(url)
      if (detectedPlatform) {
        const prisma = await getPrismaClient()
        const defaultCredential = await prisma.gitCredential.findFirst({
          where: {
            userId,
            platform: detectedPlatform,
            isDefault: true,
            isActive: true
          }
        })

        if (defaultCredential) {
          try {
            credentials = decryptCredentials(defaultCredential.encryptedCredentials)
            platform = defaultCredential.platform
            authType = defaultCredential.authType
            console.log('🔐 使用默认认证配置:', { platform, authType })
          } catch (error) {
            console.error(`❌ 解密默认认证配置失败 (ID: ${defaultCredential.id}):`, error instanceof Error ? error.message : String(error))
            console.log('💡 跳过无效的默认认证配置')
            credentials = null
          }
        }
      }
    }

    // 使用GitOperations进行真实验证
    const result = await gitOps.validateRepository(url, {
      credentials,
      platform: platform as any,
      authType: authType as any
    })

    return result

  } catch (error) {
    console.error('Git仓库验证失败:', error)
    return {
      url,
      type: 'git',
      accessible: false,
      error: '仓库验证失败'
    }
  } finally {
    // 清理临时文件
    await gitOps.cleanup()
  }
}

// 检查仓库可访问性
async function checkRepositoryAccessibility(url: string): Promise<boolean> {
  try {
    // 使用git ls-remote命令检查仓库可访问性
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)

    // 设置超时时间为10秒
    const timeout = 10000
    const command = `git ls-remote --heads "${url}"`

    await execAsync(command, { timeout })
    return true
  } catch (error) {
    console.log('仓库可访问性检查失败:', error instanceof Error ? error.message : '未知错误')
    return false
  }
}

// 获取分支列表（模拟）
async function getBranches(url: string): Promise<string[]> {
  // 实际实现中应该使用git ls-remote --heads命令
  // 这里返回常见的分支名称
  const commonBranches = ['main', 'master', 'develop', 'dev']
  
  // 模拟根据仓库URL返回不同的分支
  if (url.includes('legacy')) {
    return ['master', 'develop', 'release']
  }
  
  return commonBranches
}

// 获取默认分支
function getDefaultBranch(branches: string[]): string {
  if (branches.includes('main')) return 'main'
  if (branches.includes('master')) return 'master'
  return branches[0] || 'main'
}

// 检测项目类型（模拟）
async function detectProjectType(url: string): Promise<ProjectDetectionResult> {
  // 实际实现中应该克隆仓库并分析文件结构
  // 这里模拟检测过程
  
  const frameworks: string[] = []
  let detectedType = ''
  let packageManager = ''
  let hasDockerfile = false
  let hasCI = false

  // 模拟根据URL或仓库名称推测项目类型
  const repoName = url.split('/').pop()?.toLowerCase() || ''
  
  if (repoName.includes('react') || repoName.includes('frontend')) {
    detectedType = 'react-app'
    frameworks.push('React')
    packageManager = 'npm'
  } else if (repoName.includes('vue')) {
    detectedType = 'vue-app'
    frameworks.push('Vue')
    packageManager = 'npm'
  } else if (repoName.includes('next')) {
    detectedType = 'nextjs-app'
    frameworks.push('Next.js', 'React')
    packageManager = 'npm'
  } else if (repoName.includes('node') || repoName.includes('api')) {
    detectedType = 'nodejs-api'
    frameworks.push('Node.js')
    packageManager = 'npm'
  } else if (repoName.includes('spring') || repoName.includes('java')) {
    detectedType = 'spring-boot'
    frameworks.push('Spring Boot', 'Java')
    packageManager = 'maven'
  } else if (repoName.includes('python') || repoName.includes('flask')) {
    detectedType = 'python-flask'
    frameworks.push('Python', 'Flask')
    packageManager = 'pip'
  }

  // 检测Docker和CI配置（模拟）
  hasDockerfile = Math.random() > 0.7
  hasCI = Math.random() > 0.6

  // 生成建议
  const suggestions = PROJECT_TEMPLATES
    .filter(template => {
      if (!detectedType) return template.id === 'custom'
      return template.id === detectedType || template.tags.some(tag => 
        frameworks.some(framework => framework.toLowerCase().includes(tag.toLowerCase()))
      )
    })
    .map(template => ({
      template,
      reason: template.id === detectedType 
        ? '基于仓库名称和结构检测'
        : '基于检测到的技术栈推荐',
      confidence: template.id === detectedType ? 0.9 : 0.6
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  return {
    detectedType,
    confidence: detectedType ? 0.8 : 0.3,
    suggestions,
    packageManager,
    hasDockerfile,
    hasCI,
    frameworks
  }
}

// 验证仓库API端点
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    
    // 验证输入数据
    const validationResult = RepositoryValidationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { url, type, credentialId } = validationResult.data
    const { user } = authResult

    console.log('🔍 验证仓库:', { url, type, credentialId, userId: user.id })

    let repositoryInfo: RepositoryInfo

    if (type === 'git') {
      repositoryInfo = await validateGitRepository(url, user.id, credentialId)
    } else {
      // SVN支持（如果需要）
      repositoryInfo = {
        url,
        type: 'svn',
        accessible: false,
        error: 'SVN仓库验证暂未实现'
      }
    }

    // 如果仓库可访问，获取项目检测结果
    let detection: ProjectDetectionResult | undefined
    if (repositoryInfo.accessible) {
      detection = await detectProjectType(url)
    }

    console.log('✅ 仓库验证完成:', { 
      accessible: repositoryInfo.accessible, 
      branches: repositoryInfo.branches?.length,
      detectedType: detection?.detectedType
    })

    return NextResponse.json({
      success: true,
      data: {
        repositoryInfo,
        detection
      }
    })

  } catch (error) {
    console.error('❌ 仓库验证失败:', error)
    return NextResponse.json({
      success: false,
      error: '仓库验证失败'
    }, { status: 500 })
  }
}
