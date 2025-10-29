// 智能代理输出解析器
// 用于解析kubelet-wuhrai输出，提供结构化的代理执行步骤展示

export interface AgentStep {
  id: string
  type: 'thinking' | 'command' | 'output' | 'analysis' | 'result' | 'error'
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  timestamp: Date
  metadata?: {
    command?: string
    exitCode?: number
    duration?: string
    reasoning?: string
    conclusion?: string
    toolName?: string  // 🔧 工具名称，用于识别自定义工具
  }
}

export interface AgentSession {
  id: string
  steps: AgentStep[]
  currentStepId: string | null
  status: 'idle' | 'thinking' | 'executing' | 'completed' | 'failed'
  progress: number
  totalSteps: number
}

export class AgentOutputParser {
  private session: AgentSession
  private stepIdCounter = 0

  constructor(sessionId: string = `agent_${Date.now()}`) {
    this.session = {
      id: sessionId,
      steps: [],
      currentStepId: null,
      status: 'idle',
      progress: 0,
      totalSteps: 0
    }
  }

  // 解析单个数据块
  parseChunk(chunk: string): AgentStep | null {
    if (!chunk || chunk.trim() === '') return null

    const stepId = `step_${++this.stepIdCounter}_${Date.now()}`
    const timestamp = new Date()

    // 清理ANSI转义序列
    const cleanChunk = this.cleanAnsiEscapes(chunk)

    // 1. 检测思考过程
    if (this.isThinkingContent(cleanChunk)) {
      const step: AgentStep = {
        id: stepId,
        type: 'thinking',
        content: this.extractThinkingContent(cleanChunk),
        status: 'in_progress',
        timestamp,
        metadata: {
          reasoning: this.extractThinkingContent(cleanChunk)
        }
      }
      this.addStep(step)
      return step
    }

    // 2. 检测命令执行
    if (this.isCommandContent(cleanChunk)) {
      const command = this.extractCommand(cleanChunk)
      const step: AgentStep = {
        id: stepId,
        type: 'command',
        content: cleanChunk,
        status: 'in_progress',
        timestamp,
        metadata: {
          command: command
        }
      }
      this.addStep(step)
      return step
    }

    // 3. 检测命令输出结果
    if (this.isOutputContent(cleanChunk)) {
      const step: AgentStep = {
        id: stepId,
        type: 'output',
        content: cleanChunk,
        status: 'completed',
        timestamp,
        metadata: {
          exitCode: this.extractExitCode(cleanChunk)
        }
      }
      this.addStep(step)
      return step
    }

    // 4. 检测分析内容
    if (this.isAnalysisContent(cleanChunk)) {
      const step: AgentStep = {
        id: stepId,
        type: 'analysis',
        content: cleanChunk,
        status: 'completed',
        timestamp,
        metadata: {
          reasoning: this.extractAnalysisReasoning(cleanChunk),
          conclusion: this.extractAnalysisConclusion(cleanChunk)
        }
      }
      this.addStep(step)
      return step
    }

    // 5. 检测优化建议内容
    if (this.isResultContent(cleanChunk)) {
      const step: AgentStep = {
        id: stepId,
        type: 'result',
        content: cleanChunk,
        status: 'completed',
        timestamp
      }
      this.addStep(step)
      return step
    }

    // 6. 检测错误内容
    if (this.isErrorContent(cleanChunk)) {
      const step: AgentStep = {
        id: stepId,
        type: 'error',
        content: cleanChunk,
        status: 'failed',
        timestamp
      }
      this.addStep(step)
      this.session.status = 'failed'
      return step
    }

    // 7. 默认处理为一般内容
    const step: AgentStep = {
      id: stepId,
      type: 'result',
      content: cleanChunk,
      status: 'completed',
      timestamp
    }
    this.addStep(step)
    return step
  }

  // 批量解析内容
  parseContent(content: string): AgentStep[] {
    const chunks = this.splitIntoChunks(content)
    const steps: AgentStep[] = []

    // 总是在开始时创建一个执行命令步骤
    const commandStep: AgentStep = {
      id: `step_${++this.stepIdCounter}_${Date.now()}`,
      type: 'command',
      content: '🔍 执行的命令:\n基于用户请求执行相关系统操作',
      status: 'completed',
      timestamp: new Date(),
      metadata: {
        command: '系统操作命令'
      }
    }
    steps.push(commandStep)

    for (const chunk of chunks) {
      const step = this.parseChunk(chunk)
      if (step) {
        steps.push(step)
      }
    }

    // 将所有步骤添加到session中
    this.session.steps = [...steps]
    this.session.totalSteps = steps.length
    this.updateProgress()

    return steps
  }

  // 流式解析 - 用于实时更新
  parseStreamChunk(chunk: string, isComplete: boolean = false): {
    step?: AgentStep | null
    shouldUpdate: boolean
    sessionUpdate?: Partial<AgentSession>
  } {
    const step = this.parseChunk(chunk)
    
    let sessionUpdate: Partial<AgentSession> = {}
    
    if (step) {
      // 更新会话状态
      if (step.type === 'thinking') {
        sessionUpdate.status = 'thinking'
      } else if (step.type === 'command') {
        sessionUpdate.status = 'executing'
      } else if (step.type === 'error') {
        sessionUpdate.status = 'failed'
      } else if (isComplete) {
        sessionUpdate.status = 'completed'
      }

      // 更新当前步骤
      sessionUpdate.currentStepId = step.id
      
      // 更新进度
      this.updateProgress()
      sessionUpdate.progress = this.session.progress
      sessionUpdate.totalSteps = this.session.totalSteps
    }

    return {
      step,
      shouldUpdate: !!step,
      sessionUpdate
    }
  }

  // 获取当前会话状态
  getSession(): AgentSession {
    return { ...this.session }
  }

  // 获取所有步骤
  getSteps(): AgentStep[] {
    return [...this.session.steps]
  }

  // 获取当前步骤
  getCurrentStep(): AgentStep | null {
    if (!this.session.currentStepId) return null
    return this.session.steps.find(step => step.id === this.session.currentStepId) || null
  }

  // 重置会话
  reset(): void {
    this.session = {
      id: `agent_${Date.now()}`,
      steps: [],
      currentStepId: null,
      status: 'idle',
      progress: 0,
      totalSteps: 0
    }
    this.stepIdCounter = 0
  }

  // ============ 私有方法 ============

  private addStep(step: AgentStep): void {
    this.session.steps.push(step)
    this.session.currentStepId = step.id
    this.session.totalSteps = this.session.steps.length
    this.updateProgress()
  }

  private updateProgress(): void {
    const completed = this.session.steps.filter(step => 
      step.status === 'completed' || step.status === 'failed'
    ).length
    
    this.session.totalSteps = this.session.steps.length
    this.session.progress = this.session.totalSteps > 0 
      ? Math.round((completed / this.session.totalSteps) * 100) 
      : 0
  }

  private cleanAnsiEscapes(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*[mGKHfABCDsuJnpqr]/g, '')
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
      .replace(/\x1b\[[\d;]*[A-Za-z]/g, '')
      .replace(/\x1b\[[?]?[0-9;]*[hlc]/g, '')
      .replace(/\x1b\]/g, '')
      .replace(/\x1b\\/g, '')
      .replace(/\x1b[()][AB012]/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/\x1b[78]/g, '')
      .replace(/\x1b[DEHMN]/g, '')
      .replace(/\x1b\[[\d;]*[~]/g, '')
      .replace(/\x1b\[[0-9;]*[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/g, '')
      .replace(/\x1b\[[0-9;]*[abcdefghijklmnopqrstuvwxyz]/g, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
  }

  private splitIntoChunks(content: string): string[] {
    // 根据AI回复的标题结构分割内容
    const titlePatterns = [
      { pattern: /🔍\s*执行的命令[：:]([\s\S]*?)(?=📈|✅|💡|$)/, type: 'command' },
      { pattern: /📈\s*实际结果[：:]([\s\S]*?)(?=✅|💡|🔍|$)/, type: 'output' },
      { pattern: /✅\s*状态分析[：:]([\s\S]*?)(?=💡|🔍|📈|$)/, type: 'analysis' },
      { pattern: /💡\s*优化建议[：:]([\s\S]*?)(?=🔍|📈|✅|$)/, type: 'result' }
    ]

    let chunks: string[] = []
    
    // 按顺序查找各个标题段落
    for (const { pattern, type } of titlePatterns) {
      const match = content.match(pattern)
      if (match) {
        const title = match[0].split(/[：:]/)[0].trim()
        const sectionContent = match[1]?.trim()
        
        if (sectionContent) {
          chunks.push(`${title}\n${sectionContent}`)
        }
      }
    }

    // 如果没有找到标题标记，使用传统分割方式
    if (chunks.length === 0) {
      const fallbackMarkers = [
        /🤔[\s\S]*?(?=🤔|💻|$)/g,
        /💻[\s\S]*?(?=🤔|💻|$)/g,
        /```[\s\S]*?```/g,
        /\n\n+/g
      ]

      chunks = [content]
      
      for (const marker of fallbackMarkers) {
        const newChunks: string[] = []
        for (const chunk of chunks) {
          const matches = chunk.match(marker)
          if (matches) {
            let remainingText = chunk
            for (const match of matches) {
              const parts = remainingText.split(match)
              if (parts[0].trim()) newChunks.push(parts[0].trim())
              newChunks.push(match.trim())
              remainingText = parts.slice(1).join(match)
            }
            if (remainingText.trim()) newChunks.push(remainingText.trim())
          } else {
            newChunks.push(chunk)
          }
        }
        chunks = newChunks
      }
    }

    return chunks.filter(chunk => chunk.trim() !== '')
  }

  // 检测方法
  private isThinkingContent(content: string): boolean {
    return /🤔|思考|thinking|analyzing|正在分析|让我|我需要|我来|考虑|分析一下/.test(content)
  }

  private isCommandContent(content: string): boolean {
    return /🔍.*执行的命令|💻|kubectl|执行:|运行:|命令:|command:|executing|running/.test(content) ||
           /^(kubectl|docker|ssh|curl|grep|awk|sed|find|ls|cat|tail|head|ps|top|netstat|systemctl)\s/.test(content.toLowerCase())
  }

  private isOutputContent(content: string): boolean {
    return /📈.*实际结果/.test(content) ||
           /^(NAMESPACE|NAME|READY|STATUS|RESTARTS|AGE|CLUSTER-IP|EXTERNAL-IP|PORT|SELECTOR)/.test(content) ||
           /\s+Running\s+|\s+Pending\s+|\s+Failed\s+|\s+Succeeded\s+/.test(content) ||
           /Error from server|error:|failed:|no resources found/i.test(content)
  }

  private isAnalysisContent(content: string): boolean {
    return /✅.*状态分析|分析结果|分析总结|总结|结论|建议|推荐|solution|recommendation|summary|conclusion/.test(content)
  }

  private isErrorContent(content: string): boolean {
    return /error:|failed:|exception:|错误:|失败:|异常:|Error from server/i.test(content) &&
           !this.isOutputContent(content) // 排除命令输出中的错误
  }

  private isResultContent(content: string): boolean {
    return /💡.*优化建议/.test(content)
  }

  // 提取方法
  private extractThinkingContent(content: string): string {
    return content.replace(/🤔\s*/, '').trim()
  }

  private extractCommand(content: string): string {
    // 首先尝试从"🔍 执行的命令"标题中提取
    const titleCommandMatch = content.match(/🔍\s*执行的命令[：:]\s*([\s\S]*)/i)
    if (titleCommandMatch) {
      // 提取命令列表中的第一个命令，或所有命令的摘要
      const commandSection = titleCommandMatch[1].trim()
      // 提取第一行作为主要命令，或提取bullet point中的命令
      const firstCommand = commandSection.match(/^[•\-*]\s*([^\n-]+)/m)
      if (firstCommand) {
        return firstCommand[1].trim()
      }
      // 如果没有bullet point，返回第一行
      const firstLine = commandSection.split('\n')[0]
      return firstLine.trim()
    }
    
    // 回退到原有的命令提取逻辑
    const commandMatch = content.match(/💻\s*执行[：:]\s*(.+)|💻\s*(.+)|^(kubectl|docker|ssh|curl|grep|awk|sed|find|ls|cat|tail|head|ps|top|netstat|systemctl).+$/im)
    return commandMatch ? (commandMatch[1] || commandMatch[2] || commandMatch[3] || '').trim() : ''
  }

  private extractExitCode(content: string): number {
    const exitCodeMatch = content.match(/exit\s+code[：:]?\s*(\d+)|返回码[：:]?\s*(\d+)/i)
    return exitCodeMatch ? parseInt(exitCodeMatch[1] || exitCodeMatch[2]) : 0
  }

  private extractAnalysisReasoning(content: string): string {
    const reasoning = content.split(/结论|总结|建议|recommendation|conclusion/i)[0]
    return reasoning?.trim() || ''
  }

  private extractAnalysisConclusion(content: string): string {
    const conclusionMatch = content.split(/结论|总结|建议|recommendation|conclusion/i)
    return conclusionMatch.length > 1 ? conclusionMatch.slice(1).join('').trim() : ''
  }
}

// 单例模式的全局解析器
export const globalAgentParser = new AgentOutputParser()

// 工具函数
export function createAgentParser(sessionId?: string): AgentOutputParser {
  return new AgentOutputParser(sessionId)
}

export function parseAgentOutput(content: string, parser?: AgentOutputParser): AgentStep[] {
  const activeParser = parser || globalAgentParser
  return activeParser.parseContent(content)
}