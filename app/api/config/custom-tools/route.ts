import { NextRequest, NextResponse } from 'next/server'
import { 
  requireAuth, 
  successResponse, 
  errorResponse,
  serverErrorResponse
} from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

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

// 默认自定义工具配置
const DEFAULT_CUSTOM_TOOLS_CONFIG: CustomToolsConfig = {
  enabled: false,
  tools: [],
  defaultTimeout: 30000,
  maxConcurrency: 5,
  logLevel: 'info'
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

// 从kubelet-wuhrai获取自定义工具配置
async function getKubeletWuhraiCustomToolsConfig(): Promise<CustomToolsConfig> {
  try {
    // 检测是否在构建环境中，如果是则直接返回默认配置
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('📦 构建环境检测到，跳过kubelet-wuhrai连接')
      return {
        ...DEFAULT_CUSTOM_TOOLS_CONFIG,
        tools: EXAMPLE_TOOLS
      }
    }
    
    // 尝试从kubelet-wuhrai API获取自定义工具状态
    const response = await fetch('http://47.99.137.248:2081/api/config/custom-tools', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000) // 减少超时时间到3秒
    })

    if (response.ok) {
      const result = await response.json()

      // 后端返回格式: {success: true, data: {enabled, tools}}
      if (result.success && result.data) {
        const backendConfig = result.data
        return {
          enabled: backendConfig.enabled || false,
          tools: backendConfig.tools || EXAMPLE_TOOLS,
          defaultTimeout: backendConfig.defaultTimeout || 30000,
          maxConcurrency: backendConfig.maxConcurrency || 5,
          logLevel: backendConfig.logLevel || 'info'
        }
      }
    }

    // 如果kubelet-wuhrai不支持或未启用，返回示例配置
    return {
      ...DEFAULT_CUSTOM_TOOLS_CONFIG,
      tools: EXAMPLE_TOOLS
    }

  } catch (error) {
    // 静默处理连接错误，这在构建时是正常的
    console.log('kubelet-wuhrai连接失败，使用默认自定义工具配置')
    return {
      ...DEFAULT_CUSTOM_TOOLS_CONFIG,
      tools: EXAMPLE_TOOLS
    }
  }
}

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
    
    // 从数据库获取用户的自定义工具配置
    let dbConfig = await prisma.customToolsConfig.findUnique({
      where: { userId: user.id }
    })
    
    // 如果用户没有配置，创建默认配置
    if (!dbConfig) {
      dbConfig = await prisma.customToolsConfig.create({
        data: {
          userId: user.id,
          enabled: false,
          tools: [],
          defaultTimeout: 30000,
          maxConcurrency: 5,
          logLevel: 'info'
        }
      })
    }

    // 从kubelet-wuhrai获取实际配置（作为补充）
    const kubeletConfig = await getKubeletWuhraiCustomToolsConfig()

    // 合并数据库配置和示例工具
    const config: CustomToolsConfig = {
      enabled: dbConfig.enabled,
      tools: Array.isArray(dbConfig.tools) ? (dbConfig.tools as unknown as CustomTool[]) : [],
      defaultTimeout: dbConfig.defaultTimeout,
      maxConcurrency: dbConfig.maxConcurrency,
      logLevel: dbConfig.logLevel as any
    }

    // 如果数据库中没有工具配置，使用示例工具
    if (config.tools.length === 0 && kubeletConfig.tools.length > 0) {
      config.tools = kubeletConfig.tools
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
    console.log('💾 保存自定义工具配置:', body)

    // 验证配置格式
    if (!body || typeof body.enabled !== 'boolean') {
      return errorResponse('无效的自定义工具配置', '配置格式不正确', 400)
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    const config: CustomToolsConfig = {
      enabled: body.enabled,
      tools: body.tools || [],
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
      where: { userId: user.id },
      update: {
        enabled: config.enabled,
        tools: config.tools as any,
        defaultTimeout: config.defaultTimeout,
        maxConcurrency: config.maxConcurrency,
        logLevel: config.logLevel
      },
      create: {
        userId: user.id,
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
      config: config,
      totalTools: config.tools.length,
      activeTools: config.tools.filter(t => t.isActive).length
    })

  } catch (error) {
    console.error('保存自定义工具配置失败:', error)
    return serverErrorResponse(error)
  }
}