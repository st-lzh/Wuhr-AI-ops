import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../../lib/config/database'
import { z } from 'zod'
import { RepositoryInfo, ProjectDetectionResult, PROJECT_TEMPLATES } from '../../../../types/project-template'
import { GitOperations } from '../../../../../lib/git/gitOperations'
import { decryptCredentials } from '../../../../../lib/crypto/encryption'
import { spawn } from 'node:child_process'

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

async function resolveSVNCredentials(credentialId?: string) {
  if (!credentialId) return undefined
  const prisma = await getPrismaClient()
  const credential = await prisma.gitCredential.findFirst({
    where: { id: credentialId, isActive: true }
  })
  if (!credential) throw new Error('指定的仓库认证配置不存在')
  return decryptCredentials(credential.encryptedCredentials) as {
    username?: string
    password?: string
  }
}

function runSVN(args: string[], credentials?: { username?: string; password?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const authArgs = [
      '--non-interactive',
      '--no-auth-cache',
      ...(credentials?.username ? ['--username', credentials.username] : []),
      ...(credentials?.password ? ['--password-from-stdin'] : [])
    ]
    const child = spawn('svn', [...args, ...authArgs], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('SVN 仓库检查超时'))
    }, 20_000)

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
      if (stdout.length > 2 * 1024 * 1024) child.kill('SIGTERM')
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
      if (stderr.length > 64 * 1024) child.kill('SIGTERM')
    })
    child.once('error', error => {
      clearTimeout(timer)
      reject(error.message.includes('ENOENT') ? new Error('服务端未安装 SVN 客户端') : error)
    })
    child.once('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(stderr.trim().split('\n').slice(-2).join(' ') || `SVN 命令退出码 ${code}`))
    })
    child.stdin.end(credentials?.password ? `${credentials.password}\n` : '')
  })
}

async function validateSVNRepository(url: string, credentialId?: string): Promise<RepositoryInfo> {
  try {
    const credentials = await resolveSVNCredentials(credentialId)
    await runSVN(['info', '--xml', url], credentials)
    const listing = await runSVN(['list', '--xml', url], credentials)
    const entries = Array.from(listing.matchAll(/<name>([^<]+)<\/name>/g), match => match[1])
    const branches = entries.includes('trunk') ? ['trunk'] : []
    if (entries.includes('branches')) {
      try {
        const branchListing = await runSVN(['list', '--xml', `${url.replace(/\/$/, '')}/branches`], credentials)
        branches.push(...Array.from(branchListing.matchAll(/<name>([^<]+)<\/name>/g), match => match[1]))
      } catch {
        // branches 目录无读取权限时，仓库本身仍然是可用的。
      }
    }

    let projectType: string | undefined
    let packageManager: string | undefined
    if (entries.includes('package.json')) {
      projectType = 'nodejs-api'
      packageManager = entries.includes('pnpm-lock.yaml') ? 'pnpm' : entries.includes('yarn.lock') ? 'yarn' : 'npm'
    } else if (entries.includes('pom.xml') || entries.includes('mvnw')) {
      projectType = 'spring-boot'
      packageManager = 'maven'
    } else if (entries.includes('requirements.txt') || entries.includes('pyproject.toml')) {
      projectType = 'python-flask'
      packageManager = 'pip'
    } else if (entries.includes('Dockerfile')) {
      projectType = 'docker-app'
    }

    return {
      url,
      type: 'svn',
      accessible: true,
      branches,
      defaultBranch: entries.includes('trunk') ? 'trunk' : undefined,
      projectType,
      packageManager,
      hasDockerfile: entries.includes('Dockerfile'),
      hasCI: entries.some(name => ['Jenkinsfile', '.gitlab-ci.yml', '.github'].includes(name))
    }
  } catch (error) {
    return {
      url,
      type: 'svn',
      accessible: false,
      error: error instanceof Error ? error.message : 'SVN 仓库验证失败'
    }
  }
}

// GitOperations 已经通过浅克隆读取真实文件结构，这里只把检测结果映射成模板建议。
function buildDetection(repositoryInfo: RepositoryInfo): ProjectDetectionResult {
  const detectedType = repositoryInfo.projectType || ''
  const frameworks = detectedType
    ? PROJECT_TEMPLATES.find(item => item.id === detectedType)?.tags || []
    : []
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
        ? '基于仓库真实文件结构检测'
        : '基于检测到的技术栈推荐',
      confidence: template.id === detectedType ? 0.9 : 0.6
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  return {
    detectedType,
    confidence: detectedType ? 0.9 : 0,
    suggestions,
    packageManager: repositoryInfo.packageManager,
    hasDockerfile: repositoryInfo.hasDockerfile === true,
    hasCI: repositoryInfo.hasCI === true,
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
      repositoryInfo = await validateSVNRepository(url, credentialId)
    }

    // 如果仓库可访问，获取项目检测结果
    let detection: ProjectDetectionResult | undefined
    if (repositoryInfo.accessible) {
      detection = buildDetection(repositoryInfo)
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
