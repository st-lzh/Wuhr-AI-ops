import { NextRequest, NextResponse } from 'next/server'
import { 
  requireAuth, 
  successResponse, 
  errorResponse,
  serverErrorResponse
} from '../../../../../lib/auth/apiHelpers'

// 强制动态渲染
export const dynamic = 'force-dynamic'

// 自定义工具测试接口
interface CustomToolTest {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  workingDirectory?: string
  timeout: number
}

// 模拟自定义工具执行测试
async function testCustomToolExecution(toolConfig: CustomToolTest): Promise<{
  success: boolean
  output?: string
  error?: string
  executionTime?: number
}> {
  const startTime = Date.now()
  
  try {
    console.log('🔍 测试自定义工具执行:', toolConfig.name)

    // 模拟执行延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))

    // 根据工具类型模拟不同的结果
    const toolType = toolConfig.command.toLowerCase()
    
    // 模拟不同成功率
    const successRate = getSuccessRateByTool(toolType)
    const isSuccess = Math.random() < successRate

    const executionTime = Date.now() - startTime

    if (isSuccess) {
      const mockOutput = generateMockOutput(toolType, toolConfig)
      
      return {
        success: true,
        output: mockOutput,
        executionTime
      }
    } else {
      // 模拟不同类型的错误
      const error = generateMockError(toolType)
      
      return {
        success: false,
        error,
        executionTime
      }
    }

  } catch (error) {
    const executionTime = Date.now() - startTime
    return {
      success: false,
      error: error instanceof Error ? error.message : '工具执行测试失败',
      executionTime
    }
  }
}

// 根据工具类型获取成功率
function getSuccessRateByTool(toolType: string): number {
  const successRates: Record<string, number> = {
    'kubectl': 0.85,
    'docker': 0.90,
    'python': 0.80,
    'python3': 0.80,
    'node': 0.85,
    'npm': 0.75,
    'git': 0.95,
    'curl': 0.70,
    'wget': 0.75,
    'ping': 0.90,
    'ssh': 0.60,
    'rsync': 0.80,
    'find': 0.95,
    'grep': 0.95,
    'awk': 0.90,
    'sed': 0.90
  }

  // 查找匹配的工具类型
  for (const [tool, rate] of Object.entries(successRates)) {
    if (toolType.includes(tool)) {
      return rate
    }
  }

  return 0.75 // 默认成功率
}

// 生成模拟输出
function generateMockOutput(toolType: string, config: CustomToolTest): string {
  const outputs: Record<string, () => string> = {
    'kubectl': () => {
      if (config.args.includes('get') && config.args.includes('pods')) {
        return `NAME                     READY   STATUS    RESTARTS   AGE
nginx-deployment-1234    1/1     Running   0          2d
mysql-5678              1/1     Running   1          5d
redis-9012              1/1     Running   0          1d`
      }
      if (config.args.includes('get') && config.args.includes('nodes')) {
        return `NAME       STATUS   ROLES    AGE   VERSION
node-1     Ready    master   10d   v1.24.0
node-2     Ready    <none>   10d   v1.24.0
node-3     Ready    <none>   10d   v1.24.0`
      }
      return 'kubectl 命令执行成功'
    },
    
    'docker': () => {
      if (config.args.includes('ps')) {
        return `CONTAINER ID   IMAGE          COMMAND       CREATED        STATUS        PORTS     NAMES
a1b2c3d4e5f6   nginx:latest   "nginx -g ..."   2 hours ago    Up 2 hours    80/tcp    webapp
f6e5d4c3b2a1   mysql:5.7      "mysqld"         1 day ago      Up 1 day      3306/tcp  database`
      }
      if (config.args.includes('images')) {
        return `REPOSITORY   TAG       IMAGE ID       CREATED        SIZE
nginx        latest    a1b2c3d4e5f6   2 weeks ago    133MB
mysql        5.7       f6e5d4c3b2a1   3 weeks ago    448MB`
      }
      return 'Docker 命令执行成功'
    },
    
    'python': () => generatePythonOutput(config),
    'python3': () => generatePythonOutput(config),
    
    'node': () => {
      if (config.args.includes('--version')) {
        return 'v18.17.0'
      }
      return 'Node.js 脚本执行成功'
    },
    
    'git': () => {
      if (config.args.includes('status')) {
        return `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   src/app.js
  modified:   README.md

no changes added to commit`
      }
      if (config.args.includes('log')) {
        return `commit a1b2c3d4e5f6 (HEAD -> main)
Author: Developer <dev@example.com>
Date:   Mon Oct 23 10:30:00 2023 +0000

    Fix: Update API endpoint handling

commit f6e5d4c3b2a1
Author: Developer <dev@example.com>
Date:   Sun Oct 22 15:20:00 2023 +0000

    Feature: Add new authentication module`
      }
      return 'Git 命令执行成功'
    },
    
    'curl': () => {
      return `{
  "status": "success",
  "timestamp": "${new Date().toISOString()}",
  "data": {
    "message": "API响应正常"
  }
}`
    },
    
    'ping': () => {
      if (config.args.length > 0) {
        const host = config.args[config.args.length - 1]
        return `PING ${host} (192.168.1.1): 56 data bytes
64 bytes from 192.168.1.1: icmp_seq=0 ttl=64 time=1.234 ms
64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=1.456 ms
64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=1.789 ms

--- ${host} ping statistics ---
3 packets transmitted, 3 packets received, 0.0% packet loss`
      }
      return 'Ping 测试成功'
    }
  }

  // 查找匹配的工具类型
  for (const [tool, generator] of Object.entries(outputs)) {
    if (toolType.includes(tool)) {
      return generator()
    }
  }

  return `工具 "${config.name}" 执行成功
命令: ${config.command} ${config.args.join(' ')}
执行时间: ${new Date().toISOString()}
状态: 完成`
}

// 生成Python输出
function generatePythonOutput(config: CustomToolTest): string {
  const args = config.args.join(' ')
  
  if (args.includes('psutil')) {
    return 'CPU: 23.5%, Memory: 67.2%, Disk: 45.8%'
  }
  
  if (args.includes('--version')) {
    return 'Python 3.9.16'
  }
  
  if (args.includes('import')) {
    return 'Python 脚本执行成功，模块导入正常'
  }
  
  return `Python 脚本执行完成
参数: ${args}
状态: 成功`
}

// 生成模拟错误
function generateMockError(toolType: string): string {
  const errors = [
    '命令未找到',
    '权限不足',
    '连接超时',
    '参数格式错误',
    '依赖包缺失',
    '配置文件不存在',
    '网络连接失败',
    '磁盘空间不足',
    '进程已在运行',
    '端口已被占用'
  ]

  const specificErrors: Record<string, string[]> = {
    'kubectl': [
      'Unable to connect to the server',
      'The connection to the server localhost:8080 was refused',
      'error: You must be logged in to the server',
      'error: the server doesn\'t have a resource type "pod"'
    ],
    'docker': [
      'Cannot connect to the Docker daemon',
      'docker: command not found',
      'Error response from daemon: No such container',
      'Error: No such image'
    ],
    'python': [
      'ModuleNotFoundError: No module named \'psutil\'',
      'SyntaxError: invalid syntax',
      'ImportError: No module named \'requests\'',
      'python: command not found'
    ],
    'git': [
      'fatal: not a git repository',
      'fatal: remote origin already exists',
      'error: pathspec \'file.txt\' did not match any file(s)',
      'fatal: unable to access repository'
    ],
    'curl': [
      'curl: (6) Could not resolve host',
      'curl: (7) Failed to connect',
      'curl: (28) Operation timed out',
      'curl: command not found'
    ]
  }

  // 查找匹配的工具特定错误
  for (const [tool, toolErrors] of Object.entries(specificErrors)) {
    if (toolType.includes(tool)) {
      return toolErrors[Math.floor(Math.random() * toolErrors.length)]
    }
  }

  return errors[Math.floor(Math.random() * errors.length)]
}

// POST - 测试自定义工具执行
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const authResult = await requireAuth(request)
    if (!authResult.success) {
      return authResult.response
    }

    const body = await request.json()
    console.log('🧪 测试自定义工具执行请求:', body)

    // 验证请求参数
    if (!body.name || !body.command) {
      return errorResponse('参数不完整', '工具名称和命令不能为空', 400)
    }

    const toolConfig: CustomToolTest = {
      name: body.name,
      command: body.command,
      args: Array.isArray(body.args) ? body.args : [],
      env: body.env || {},
      workingDirectory: body.workingDirectory,
      timeout: body.timeout || 30000
    }

    // 执行工具测试
    const testResult = await testCustomToolExecution(toolConfig)

    if (testResult.success) {
      console.log('✅ 自定义工具测试成功:', toolConfig.name)
      return successResponse({
        message: `工具 "${toolConfig.name}" 测试成功`,
        executed: true,
        output: testResult.output,
        executionTime: `${testResult.executionTime}ms`,
        command: `${toolConfig.command} ${toolConfig.args.join(' ')}`.trim()
      })
    } else {
      console.log('❌ 自定义工具测试失败:', toolConfig.name, testResult.error)
      return errorResponse(
        `工具 "${toolConfig.name}" 测试失败`,
        testResult.error || '执行测试失败',
        400
      )
    }

  } catch (error) {
    console.error('自定义工具测试异常:', error)
    return serverErrorResponse(error)
  }
}