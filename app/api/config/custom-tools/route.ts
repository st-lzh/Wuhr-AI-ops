import { NextRequest } from 'next/server'
import { 
  requireAuth, 
  successResponse, 
  errorResponse,
  serverErrorResponse
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { canWriteTeamAssets, resolveTeamConfigOwnerId } from '../../../../lib/auth/teamAccess'
import { maskEnvironment, protectEnvironment } from '../../../../lib/crypto/environmentSecrets'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 自定义工具接口定义
interface CustomTool {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  workingDirectory?: string
  env: Record<string, string>
  category: string
  version: string
  isActive: boolean
  timeout: number
  inputSchema: any
  outputSchema: any
  examples: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface CustomToolsConfig {
  enabled: boolean
  tools: CustomTool[]
  defaultTimeout: number
  maxConcurrency: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

function maskTools(tools: CustomTool[]): CustomTool[] {
  return tools.map(tool => ({ ...tool, env: maskEnvironment(tool.env) }))
}

// 示例自定义工具
const EXAMPLE_TOOLS: CustomTool[] = [
  {
    id: 'kubectl-get-pods',
    name: 'kubectl获取Pod列表',
    description: '获取指定命名空间下的Pod列表',
    command: 'kubectl',
    args: ['get', 'pods'],
    workingDirectory: '',
    env: {},
    category: 'system',
    version: '1.0.0',
    isActive: true,
    timeout: 15000,
    inputSchema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: '命名空间' },
        output: { type: 'string', enum: ['wide', 'yaml', 'json'], description: '输出格式' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        pods: { type: 'array', description: 'Pod列表' }
      }
    },
    examples: [
      'kubectl get pods -n kube-system',
      'kubectl get pods --all-namespaces',
      'kubectl get pods -o wide'
    ],
    tags: ['kubernetes', 'kubectl', 'monitoring'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'docker-ps',
    name: 'Docker容器列表',
    description: '获取正在运行的Docker容器列表',
    command: 'docker',
    args: ['ps'],
    workingDirectory: '',
    env: {},
    category: 'development',
    version: '1.0.0',
    isActive: true,
    timeout: 10000,
    inputSchema: {
      type: 'object',
      properties: {
        all: { type: 'boolean', description: '显示所有容器（包括停止的）' },
        format: { type: 'string', description: '输出格式' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        containers: { type: 'array', description: '容器列表' }
      }
    },
    examples: [
      'docker ps',
      'docker ps -a',
      'docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Status}}"'
    ],
    tags: ['docker', 'container', 'monitoring'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'system-monitor',
    name: '系统资源监控',
    description: '监控CPU、内存、磁盘使用情况',
    command: 'python3',
    args: ['-c', 'import psutil; print(f"CPU: {psutil.cpu_percent()}%, Memory: {psutil.virtual_memory().percent}%, Disk: {psutil.disk_usage(\"/\").percent}%")'],
    workingDirectory: '',
    env: {},
    category: 'system',
    version: '1.0.0',
    isActive: true,
    timeout: 5000,
    inputSchema: {
      type: 'object',
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        cpu: { type: 'number', description: 'CPU使用率' },
        memory: { type: 'number', description: '内存使用率' },
        disk: { type: 'number', description: '磁盘使用率' }
      }
    },
    examples: ['获取系统资源使用情况'],
    tags: ['system', 'monitoring', 'python'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// 验证工具配置
function validateCustomTool(tool: any): string[] {
  const errors: string[] = []
  
  if (!tool.name?.trim()) {
    errors.push('工具名称不能为空')
  }
  
  if (!tool.command?.trim()) {
    errors.push('命令不能为空')
  }
  
  if (!tool.category?.trim()) {
    errors.push('分类不能为空')
  }
  
  if (tool.timeout && (typeof tool.timeout !== 'number' || tool.timeout <= 0)) {
    errors.push('超时时间必须是正数')
  }
  
  // 验证JSON schema
  if (tool.inputSchema) {
    try {
      if (typeof tool.inputSchema === 'string') {
        JSON.parse(tool.inputSchema)
      }
    } catch {
      errors.push('输入结构JSON格式无效')
    }
  }
  
  if (tool.outputSchema) {
    try {
      if (typeof tool.outputSchema === 'string') {
        JSON.parse(tool.outputSchema)
      }
    } catch {
      errors.push('输出结构JSON格式无效')
    }
  }
  
  // 验证环境变量
  if (tool.env) {
    try {
      if (typeof tool.env === 'string') {
        JSON.parse(tool.env)
      }
    } catch {
      errors.push('环境变量JSON格式无效')
    }
  }
  
  return errors
}

// GET - 获取自定义工具配置
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('📦 获取自定义工具配置')

    const { user } = authResult
    const prisma = await getPrismaClient()
    const teamOwnerId = await resolveTeamConfigOwnerId(prisma, user.id)
    
    // 从数据库获取用户的自定义工具配置
    let dbConfig = await prisma.customToolsConfig.findUnique({
      where: { userId: teamOwnerId }
    })
    
    // 如果用户没有配置，创建默认配置
    if (!dbConfig) {
      dbConfig = await prisma.customToolsConfig.create({
        data: {
          userId: teamOwnerId,
          enabled: false,
          // 新团队从空清单开始；工具必须由管理员显式创建并真实测试，
          // 不再自动写入可能与运行环境不匹配的演示命令。
          tools: [],
          defaultTimeout: 30000,
          maxConcurrency: 5,
          logLevel: 'info'
        }
      })
    }

    // 数据库是唯一配置源；运行时由聊天请求把已启用工具传给 Agent。
    const config: CustomToolsConfig = {
      enabled: dbConfig.enabled,
      tools: Array.isArray(dbConfig.tools)
        ? maskTools(dbConfig.tools as unknown as CustomTool[])
        : [],
      defaultTimeout: dbConfig.defaultTimeout,
      maxConcurrency: dbConfig.maxConcurrency,
      logLevel: dbConfig.logLevel as any
    }

    return successResponse({
      ...config,
      totalTools: config.tools.length,
      activeTools: config.tools.filter(t => t.isActive).length
    })

  } catch (error) {
    console.error('获取自定义工具配置失败:', error)
    return serverErrorResponse(error)
  }
}

// POST - 保存自定义工具配置
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    console.log('💾 保存自定义工具配置')

    // 验证配置格式
    if (!body || typeof body.enabled !== 'boolean') {
      return errorResponse('无效的自定义工具配置', '配置格式不正确', 400)
    }

    const { user } = authResult
    if (!canWriteTeamAssets(user, 'config:write')) {
      return errorResponse('权限不足', '需要自定义工具配置权限', 403)
    }
    const prisma = await getPrismaClient()
    const teamOwnerId = await resolveTeamConfigOwnerId(prisma, user.id)
    const existingConfig = await prisma.customToolsConfig.findUnique({ where: { userId: teamOwnerId } })
    const previousTools = Array.isArray(existingConfig?.tools)
      ? existingConfig.tools as unknown as CustomTool[]
      : []
    const incomingTools = Array.isArray(body.tools) ? body.tools as CustomTool[] : []
    const protectedTools = incomingTools.map(tool => {
      const previous = previousTools.find(item => item.id === tool.id)
      return { ...tool, env: protectEnvironment(tool.env, previous?.env) }
    })

    const config: CustomToolsConfig = {
      enabled: body.enabled,
      tools: protectedTools,
      defaultTimeout: body.defaultTimeout || 30000,
      maxConcurrency: body.maxConcurrency || 5,
      logLevel: body.logLevel || 'info'
    }

    // 验证工具配置
    for (const tool of config.tools) {
      const errors = validateCustomTool(tool)
      if (errors.length > 0) {
        return errorResponse(
          `工具 "${tool.name}" 配置无效`, 
          errors.join('; '), 
          400
        )
      }
    }

    // 保存到数据库（使用upsert确保更新或创建）
    const savedConfig = await prisma.customToolsConfig.upsert({
      where: { userId: teamOwnerId },
      update: {
        enabled: config.enabled,
        tools: config.tools as any,
        defaultTimeout: config.defaultTimeout,
        maxConcurrency: config.maxConcurrency,
        logLevel: config.logLevel
      },
      create: {
        userId: teamOwnerId,
        enabled: config.enabled,
        tools: config.tools as any,
        defaultTimeout: config.defaultTimeout,
        maxConcurrency: config.maxConcurrency,
        logLevel: config.logLevel
      }
    })

    console.log('✅ 自定义工具配置保存成功')

    return successResponse({
      message: '自定义工具配置保存成功',
      config: { ...config, tools: maskTools(config.tools) },
      totalTools: config.tools.length,
      activeTools: config.tools.filter(t => t.isActive).length
    })

  } catch (error) {
    console.error('保存自定义工具配置失败:', error)
    return serverErrorResponse(error)
  }
}
