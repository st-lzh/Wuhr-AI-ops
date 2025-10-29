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

// MCP配置接口定义
interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  isConnected: boolean
  tools: MCPTool[]
  status: 'connected' | 'disconnected' | 'error'
}

interface MCPTool {
  name: string
  description: string
  inputSchema: any
  server: string
}

interface MCPConfig {
  enabled: boolean
  servers: MCPServer[]
  discoveryEnabled: boolean
  autoConnect: boolean
}

// 默认MCP配置
const DEFAULT_MCP_CONFIG: MCPConfig = {
  enabled: false,
  servers: [],
  discoveryEnabled: true,
  autoConnect: true
}

// 示例MCP服务器配置
const EXAMPLE_SERVERS: MCPServer[] = [
  {
    id: 'filesystem',
    name: '文件系统',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
    env: {},
    isConnected: false,
    tools: [],
    status: 'disconnected'
  },
  {
    id: 'git',
    name: 'Git工具',
    command: 'npx',
    args: ['@modelcontextprotocol/server-git'],
    env: {},
    isConnected: false,
    tools: [],
    status: 'disconnected'
  },
  {
    id: 'sqlite',
    name: 'SQLite数据库',
    command: 'npx',
    args: ['@modelcontextprotocol/server-sqlite', 'database.db'],
    env: {},
    isConnected: false,
    tools: [],
    status: 'disconnected'
  }
]

// 从kubelet-wuhrai获取MCP配置
async function getKubeletWuhraiMCPConfig(): Promise<MCPConfig> {
  try {
    // 检测是否在构建环境中，如果是则直接返回默认配置
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('📦 构建环境检测到，跳过kubelet-wuhrai连接')
      return DEFAULT_MCP_CONFIG
    }
    
    // 尝试从kubelet-wuhrai API获取MCP状态
    const response = await fetch('http://localhost:8888/api/v1/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000) // 减少超时时间到3秒
    })

    if (response.ok) {
      const data = await response.json()
      
      // 解析MCP状态
      const mcpEnabled = data.mcp_client === 'enabled'
      
      return {
        enabled: mcpEnabled,
        servers: mcpEnabled ? EXAMPLE_SERVERS : [],
        discoveryEnabled: true,
        autoConnect: true
      }
    } else {
      console.log('kubelet-wuhrai未运行，使用默认MCP配置')
      return DEFAULT_MCP_CONFIG
    }
  } catch (error) {
    // 静默处理连接错误，这在构建时是正常的
    console.log('kubelet-wuhrai连接失败，使用默认MCP配置')
    return DEFAULT_MCP_CONFIG
  }
}

// 模拟MCP工具发现
function simulateToolDiscovery(server: MCPServer): MCPTool[] {
  const toolSets: Record<string, MCPTool[]> = {
    'filesystem': [
      {
        name: 'read_file',
        description: '读取文件内容',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        server: server.name
      },
      {
        name: 'write_file',
        description: '写入文件内容',
        inputSchema: { 
          type: 'object', 
          properties: { 
            path: { type: 'string' }, 
            content: { type: 'string' } 
          } 
        },
        server: server.name
      },
      {
        name: 'list_directory',
        description: '列出目录内容',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        server: server.name
      }
    ],
    'git': [
      {
        name: 'git_status',
        description: '查看Git状态',
        inputSchema: { type: 'object', properties: {} },
        server: server.name
      },
      {
        name: 'git_commit',
        description: '提交更改',
        inputSchema: { 
          type: 'object', 
          properties: { 
            message: { type: 'string' } 
          } 
        },
        server: server.name
      },
      {
        name: 'git_diff',
        description: '查看文件差异',
        inputSchema: { type: 'object', properties: { file: { type: 'string' } } },
        server: server.name
      }
    ],
    'sqlite': [
      {
        name: 'execute_query',
        description: '执行SQL查询',
        inputSchema: { 
          type: 'object', 
          properties: { 
            query: { type: 'string' } 
          } 
        },
        server: server.name
      },
      {
        name: 'describe_table',
        description: '描述表结构',
        inputSchema: { 
          type: 'object', 
          properties: { 
            table: { type: 'string' } 
          } 
        },
        server: server.name
      }
    ]
  }

  return toolSets[server.id] || []
}

// GET - 获取MCP配置
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    console.log('📦 获取MCP工具配置')

    const { user } = authResult
    const prisma = await getPrismaClient()
    
    // 从数据库获取用户的MCP配置
    let dbConfig = await prisma.mCPToolsConfig.findUnique({
      where: { userId: user.id }
    })
    
    // 如果用户没有配置，创建默认配置
    if (!dbConfig) {
      dbConfig = await prisma.mCPToolsConfig.create({
        data: {
          userId: user.id,
          enabled: false,
          servers: [],
          discoveryEnabled: true,
          autoConnect: true
        }
      })
    }

    // 从kubelet-wuhrai获取实际配置（作为补充）
    const kubeletConfig = await getKubeletWuhraiMCPConfig()
    
    // 合并数据库配置和kubelet配置
    const config: MCPConfig = {
      enabled: dbConfig.enabled,
      servers: Array.isArray(dbConfig.servers) ? (dbConfig.servers as unknown as MCPServer[]) : [],
      discoveryEnabled: dbConfig.discoveryEnabled,
      autoConnect: dbConfig.autoConnect
    }

    return successResponse({
      ...config,
      servers: config.servers.map(server => ({
        ...server,
        tools: simulateToolDiscovery(server)
      }))
    })

  } catch (error) {
    console.error('获取MCP配置失败:', error)
    return serverErrorResponse(error)
  }
}

// POST - 保存MCP配置
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    console.log('💾 保存MCP工具配置:', body)

    // 验证配置格式
    if (!body || typeof body.enabled !== 'boolean') {
      return errorResponse('无效的MCP配置', '配置格式不正确', 400)
    }

    const { user } = authResult
    const prisma = await getPrismaClient()

    const config: MCPConfig = {
      enabled: body.enabled,
      servers: body.servers || [],
      discoveryEnabled: body.discoveryEnabled !== false,
      autoConnect: body.autoConnect !== false
    }

    // 验证服务器配置
    for (const server of config.servers) {
      if (!server.name || !server.command) {
        return errorResponse('服务器配置无效', '服务器名称和命令不能为空', 400)
      }
    }

    // 保存到数据库（使用upsert确保更新或创建）
    const savedConfig = await prisma.mCPToolsConfig.upsert({
      where: { userId: user.id },
      update: {
        enabled: config.enabled,
        servers: config.servers as any,
        discoveryEnabled: config.discoveryEnabled,
        autoConnect: config.autoConnect
      },
      create: {
        userId: user.id,
        enabled: config.enabled,
        servers: config.servers as any,
        discoveryEnabled: config.discoveryEnabled,
        autoConnect: config.autoConnect
      }
    })

    console.log('✅ MCP配置保存成功')

    return successResponse({
      message: 'MCP配置保存成功',
      config: config
    })

  } catch (error) {
    console.error('保存MCP配置失败:', error)
    return serverErrorResponse(error)
  }
}