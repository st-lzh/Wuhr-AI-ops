// 智能模式识别工具
// 根据用户消息内容智能判断应该使用K8s模式还是Linux系统模式

interface ModeDetectionResult {
  suggestedMode: 'k8s' | 'linux' | 'uncertain'
  confidence: number // 0-1之间的置信度
  reason: string
  keywords: string[]
}

// K8s相关关键词词典
const K8S_KEYWORDS = {
  // 核心概念
  core: [
    'kubernetes', 'k8s', 'kubectl', 'kube-',
    'pod', 'pods', 'deployment', 'deployments', 
    'service', 'services', 'ingress', 'configmap', 'secret',
    'namespace', 'namespaces', 'node', 'nodes',
    'replicaset', 'daemonset', 'statefulset', 'job', 'cronjob'
  ],
  // 操作动词
  operations: [
    'apply', 'create', 'delete', 'get', 'describe', 'logs', 'exec',
    'port-forward', 'proxy', 'scale', 'rollout', 'patch'
  ],
  // 口语化表达
  colloquial: [
    '集群', '容器编排', '微服务', '容器集群', 'k8s集群',
    '部署到集群', '集群状态', '集群节点', '集群资源',
    '容器调度', '服务发现', '负载均衡', '滚动更新',
    '集群管理', '容器管理', '编排', '调度'
  ],
  // 资源类型
  resources: [
    'pv', 'pvc', 'storageclass', 'networkpolicy', 'rbac',
    'clusterrole', 'rolebinding', 'serviceaccount',
    'horizontalpodautoscaler', 'hpa', 'vpa'
  ]
}

// Linux系统相关关键词词典
const LINUX_KEYWORDS = {
  // 核心命令
  commands: [
    'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv',
    'cat', 'less', 'more', 'head', 'tail', 'grep', 'find',
    'ps', 'top', 'htop', 'kill', 'killall', 'jobs',
    'systemctl', 'service', 'crontab', 'chmod', 'chown',
    'df', 'du', 'free', 'uptime', 'who', 'w', 'id',
    'ssh', 'scp', 'rsync', 'wget', 'curl', 'ping'
  ],
  // 系统概念
  system: [
    '进程', '服务', '守护进程', '用户', '权限', '文件系统',
    '目录', '文件', '日志', '系统日志', '内存', 'cpu',
    '磁盘', '网络', '端口', '防火墙', '定时任务'
  ],
  // 口语化表达
  colloquial: [
    '系统', '服务器', '主机', '机器', '节点', '本地',
    '操作系统', 'linux系统', 'ubuntu', 'centos', 'debian',
    '系统状态', '系统信息', '系统监控', '系统管理',
    '文件操作', '目录操作', '进程管理', '服务管理',
    '查看系统', '检查系统', '系统诊断', '系统维护'
  ],
  // 文件路径特征
  paths: [
    '/etc/', '/var/', '/usr/', '/home/', '/opt/', '/tmp/',
    '/proc/', '/sys/', '/dev/', '/mnt/', '/boot/'
  ]
}

/**
 * 智能分析用户消息，判断应该使用的模式
 * @param message 用户消息
 * @param currentMode 当前模式 (可选)
 * @returns 模式检测结果
 */
export function detectMode(message: string, currentMode?: 'k8s' | 'linux'): ModeDetectionResult {
  const normalizedMessage = message.toLowerCase().trim()
  
  // 计算K8s相关性得分
  const k8sScore = calculateK8sScore(normalizedMessage)
  
  // 计算Linux相关性得分
  const linuxScore = calculateLinuxScore(normalizedMessage)
  
  // 分析结果
  const result = analyzeScores(k8sScore, linuxScore, normalizedMessage, currentMode)
  
  return result
}

/**
 * 计算K8s相关性得分
 */
function calculateK8sScore(message: string): { score: number; keywords: string[] } {
  let score = 0
  const foundKeywords: string[] = []
  
  // 检查核心关键词 (高权重)
  K8S_KEYWORDS.core.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 3
      foundKeywords.push(keyword)
    }
  })
  
  // 检查操作关键词 (中权重)
  K8S_KEYWORDS.operations.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 2
      foundKeywords.push(keyword)
    }
  })
  
  // 检查口语化表达 (中权重)
  K8S_KEYWORDS.colloquial.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 2
      foundKeywords.push(keyword)
    }
  })
  
  // 检查资源类型 (高权重)
  K8S_KEYWORDS.resources.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 3
      foundKeywords.push(keyword)
    }
  })
  
  return { score, keywords: foundKeywords }
}

/**
 * 计算Linux相关性得分
 */
function calculateLinuxScore(message: string): { score: number; keywords: string[] } {
  let score = 0
  const foundKeywords: string[] = []
  
  // 检查系统命令 (高权重)
  LINUX_KEYWORDS.commands.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 3
      foundKeywords.push(keyword)
    }
  })
  
  // 检查系统概念 (中权重)
  LINUX_KEYWORDS.system.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 2
      foundKeywords.push(keyword)
    }
  })
  
  // 检查口语化表达 (中权重)
  LINUX_KEYWORDS.colloquial.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 2
      foundKeywords.push(keyword)
    }
  })
  
  // 检查文件路径 (高权重)
  LINUX_KEYWORDS.paths.forEach(keyword => {
    if (message.includes(keyword)) {
      score += 3
      foundKeywords.push(keyword)
    }
  })
  
  return { score, keywords: foundKeywords }
}

/**
 * 分析得分并返回最终结果
 */
function analyzeScores(
  k8sResult: { score: number; keywords: string[] },
  linuxResult: { score: number; keywords: string[] },
  message: string,
  currentMode?: 'k8s' | 'linux'
): ModeDetectionResult {
  const { score: k8sScore, keywords: k8sKeywords } = k8sResult
  const { score: linuxScore, keywords: linuxKeywords } = linuxResult
  
  const totalScore = k8sScore + linuxScore
  
  // 如果没有匹配到任何关键词，保持当前模式或默认Linux
  if (totalScore === 0) {
    return {
      suggestedMode: currentMode || 'linux',
      confidence: 0.1,
      reason: '未检测到明确的模式指示，保持当前模式',
      keywords: []
    }
  }
  
  // 计算置信度
  const scoreDiff = Math.abs(k8sScore - linuxScore)
  const maxScore = Math.max(k8sScore, linuxScore)
  const confidence = Math.min(0.95, 0.3 + (scoreDiff / (totalScore + 1)) * 0.7)
  
  // 判断模式
  if (k8sScore > linuxScore) {
    if (k8sScore >= 3 || confidence > 0.6) {
      return {
        suggestedMode: 'k8s',
        confidence,
        reason: `检测到K8s相关关键词: ${k8sKeywords.join(', ')}`,
        keywords: k8sKeywords
      }
    }
  } else if (linuxScore > k8sScore) {
    if (linuxScore >= 3 || confidence > 0.6) {
      return {
        suggestedMode: 'linux',
        confidence,
        reason: `检测到Linux系统相关关键词: ${linuxKeywords.join(', ')}`,
        keywords: linuxKeywords
      }
    }
  }
  
  // 得分相近或置信度不足时
  return {
    suggestedMode: 'uncertain',
    confidence: Math.max(0.1, confidence - 0.2),
    reason: `模式判断不确定 (K8s得分: ${k8sScore}, Linux得分: ${linuxScore})`,
    keywords: [...k8sKeywords, ...linuxKeywords]
  }
}

/**
 * 获取模式切换建议的用户友好文本
 */
export function getModeSuggestionText(
  result: ModeDetectionResult,
  currentMode: 'k8s' | 'linux'
): string | null {
  if (result.suggestedMode === 'uncertain' || result.confidence < 0.5) {
    return null
  }
  
  if (result.suggestedMode !== currentMode) {
    const modeText = result.suggestedMode === 'k8s' ? 'K8s集群' : 'Linux系统'
    return `检测到您想要执行${modeText}相关操作，建议切换到${modeText}模式以获得更好的体验。`
  }
  
  return null
} 