import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/apiHelpers-new'
import { getPrismaClient } from '../../../../lib/config/database'
import { z } from 'zod'
import { 
  encryptCredentials, 
  decryptCredentials, 
  createGitHubTokenCredentials,
  createSSHCredentials,
  createUsernamePasswordCredentials,
  GitCredentialData
} from '../../../../lib/crypto/encryption'
import { canWriteTeamAssets } from '../../../../lib/auth/teamAccess'

// Git认证配置验证schema
const GitCredentialSchema = z.object({
  name: z.string().min(1, '认证配置名称不能为空').max(100, '名称过长'),
  platform: z.enum(['github', 'gitlab', 'gitee', 'bitbucket', 'other'], {
    errorMap: () => ({ message: '请选择有效的Git平台' })
  }),
  authType: z.enum(['token', 'ssh', 'username_password'], {
    errorMap: () => ({ message: '请选择有效的认证类型' })
  }),
  credentials: z.object({
    // GitHub PAT
    token: z.string().optional(),
    
    // SSH密钥
    privateKey: z.string().optional(),
    publicKey: z.string().optional(),
    passphrase: z.string().optional(),
    
    // 用户名密码
    username: z.string().optional(),
    password: z.string().optional(),
    email: z.string().optional()
  }),
  isDefault: z.boolean().default(false)
})

// 获取用户的Git认证配置列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    console.log('🔍 获取Git认证配置列表:', { userId: user.id })

    const credentials = await prisma.gitCredential.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        platform: true,
        authType: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    console.log('✅ 获取Git认证配置成功:', { count: credentials.length })

    return NextResponse.json({
      success: true,
      data: credentials
    })

  } catch (error) {
    console.error('❌ 获取Git认证配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取认证配置失败'
    }, { status: 500 })
  }
}

// 创建新的Git认证配置
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return NextResponse.json({ success: false, error: '没有接入凭据写入权限' }, { status: 403 })
    }
    const body = await request.json()

    // 验证输入数据
    const validationResult = GitCredentialSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: '输入数据验证失败',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const { name, platform, authType, credentials, isDefault } = validationResult.data

    console.log('🔐 创建Git认证配置:', { 
      userId: user.id, 
      name, 
      platform, 
      authType, 
      isDefault 
    })

    // 验证认证信息完整性
    let credentialData: GitCredentialData
    switch (authType) {
      case 'token':
        if (!credentials.token) {
          return NextResponse.json({
            success: false,
            error: 'Personal Access Token不能为空'
          }, { status: 400 })
        }
        credentialData = createGitHubTokenCredentials(credentials.token, credentials.username)
        break

      case 'ssh':
        if (!credentials.privateKey) {
          return NextResponse.json({
            success: false,
            error: 'SSH私钥不能为空'
          }, { status: 400 })
        }
        credentialData = createSSHCredentials(
          credentials.privateKey,
          credentials.publicKey || '',
          credentials.passphrase
        )
        break

      case 'username_password':
        if (!credentials.username || !credentials.password) {
          return NextResponse.json({
            success: false,
            error: '用户名和密码不能为空'
          }, { status: 400 })
        }
        credentialData = createUsernamePasswordCredentials(
          credentials.username,
          credentials.password,
          credentials.email
        )
        break

      default:
        return NextResponse.json({
          success: false,
          error: '不支持的认证类型'
        }, { status: 400 })
    }

    // 加密认证信息
    const encryptedCredentials = encryptCredentials(credentialData)

    const prisma = await getPrismaClient()

    // 如果设置为默认，先取消其他默认配置
    if (isDefault) {
      await prisma.gitCredential.updateMany({
        where: {
          platform,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    // 创建新的认证配置
    const newCredential = await prisma.gitCredential.create({
      data: {
        name,
        platform,
        authType,
        encryptedCredentials,
        isDefault,
        userId: user.id
      },
      select: {
        id: true,
        name: true,
        platform: true,
        authType: true,
        isDefault: true,
        createdAt: true
      }
    })

    console.log('✅ Git认证配置创建成功:', { id: newCredential.id })

    return NextResponse.json({
      success: true,
      data: newCredential,
      message: '认证配置创建成功'
    })

  } catch (error) {
    console.error('❌ 创建Git认证配置失败:', error)
    return NextResponse.json({
      success: false,
      error: '创建认证配置失败'
    }, { status: 500 })
  }
}
