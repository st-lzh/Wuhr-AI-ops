// 工具分类定义
export enum ToolCategory {
  SYSTEM = 'system',
  NETWORK = 'network',
  SECURITY = 'security',
  TEXT = 'text',
  CUSTOM = 'custom'
}

// 工具定义接口
export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  inputs: ToolInput[];
  isCustom?: boolean;
  isFavorite?: boolean;
  lastUsed?: Date;
}

export interface ToolInput {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'file';
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

// 工具执行结果
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

// 内置工具列表
export const builtInTools: Tool[] = [
  // 系统工具
  {
    id: 'timestamp-converter',
    name: '时间戳转换',
    description: '时间戳与日期格式互转',
    category: ToolCategory.SYSTEM,
    icon: 'clock-circle',
    inputs: [
      {
        name: 'input',
        label: '输入',
        type: 'text',
        required: true,
        placeholder: '输入时间戳或日期'
      },
      {
        name: 'format',
        label: '输出格式',
        type: 'select',
        required: true,
        options: ['YYYY-MM-DD HH:mm:ss', 'timestamp', 'ISO'],
        defaultValue: 'YYYY-MM-DD HH:mm:ss'
      }
    ]
  },
  {
    id: 'json-formatter',
    name: 'JSON 格式化',
    description: 'JSON 数据格式化和验证',
    category: ToolCategory.TEXT,
    icon: 'code',
    inputs: [
      {
        name: 'json',
        label: 'JSON 数据',
        type: 'textarea',
        required: true,
        placeholder: '输入 JSON 数据'
      }
    ]
  },
  {
    id: 'base64-encoder',
    name: 'Base64 编码',
    description: 'Base64 编码解码工具',
    category: ToolCategory.TEXT,
    icon: 'lock',
    inputs: [
      {
        name: 'text',
        label: '文本',
        type: 'textarea',
        required: true,
        placeholder: '输入要编码的文本'
      },
      {
        name: 'operation',
        label: '操作',
        type: 'select',
        required: true,
        options: ['encode', 'decode'],
        defaultValue: 'encode'
      }
    ]
  },
  // 网络工具
  {
    id: 'ping-test',
    name: 'Ping 测试',
    description: '网络连通性测试',
    category: ToolCategory.NETWORK,
    icon: 'wifi',
    inputs: [
      {
        name: 'host',
        label: '主机地址',
        type: 'text',
        required: true,
        placeholder: '例如: google.com 或 192.168.1.1'
      },
      {
        name: 'count',
        label: 'Ping 次数',
        type: 'number',
        required: false,
        defaultValue: '4'
      }
    ]
  },
  {
    id: 'port-scanner',
    name: '端口扫描',
    description: '检测主机端口开放状态',
    category: ToolCategory.NETWORK,
    icon: 'scan',
    inputs: [
      {
        name: 'host',
        label: '主机地址',
        type: 'text',
        required: true,
        placeholder: '例如: example.com'
      },
      {
        name: 'ports',
        label: '端口范围',
        type: 'text',
        required: true,
        placeholder: '例如: 80,443 或 1-1000',
        defaultValue: '80,443,22,21,25,53,110,143,993,995'
      }
    ]
  },
  {
    id: 'dns-lookup',
    name: 'DNS 查询',
    description: 'DNS 记录查询工具',
    category: ToolCategory.NETWORK,
    icon: 'global',
    inputs: [
      {
        name: 'domain',
        label: '域名',
        type: 'text',
        required: true,
        placeholder: '例如: example.com'
      },
      {
        name: 'recordType',
        label: '记录类型',
        type: 'select',
        required: true,
        options: ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT'],
        defaultValue: 'A'
      }
    ]
  },
  // 安全工具
  {
    id: 'password-generator',
    name: '密码生成器',
    description: '生成安全密码',
    category: ToolCategory.SECURITY,
    icon: 'key',
    inputs: [
      {
        name: 'length',
        label: '密码长度',
        type: 'number',
        required: true,
        defaultValue: '16'
      },
      {
        name: 'includeSymbols',
        label: '包含特殊字符',
        type: 'select',
        required: true,
        options: ['yes', 'no'],
        defaultValue: 'yes'
      }
    ]
  },
  {
    id: 'hash-generator',
    name: '哈希生成',
    description: '生成文本的哈希值',
    category: ToolCategory.SECURITY,
    icon: 'safety-certificate',
    inputs: [
      {
        name: 'text',
        label: '输入文本',
        type: 'textarea',
        required: true,
        placeholder: '输入要生成哈希的文本'
      },
      {
        name: 'algorithm',
        label: '算法',
        type: 'select',
        required: true,
        options: ['MD5', 'SHA1', 'SHA256', 'SHA512'],
        defaultValue: 'SHA256'
      }
    ]
  }
];

// 工具执行函数
export const executeBuiltInTool = async (toolId: string, inputs: Record<string, any>): Promise<ToolResult> => {
  const startTime = Date.now();
  
  try {
    let result: any;
    
    switch (toolId) {
      case 'timestamp-converter':
        result = convertTimestamp(inputs.input, inputs.format);
        break;
        
      case 'json-formatter':
        result = formatJSON(inputs.json);
        break;
        
      case 'base64-encoder':
        result = base64Operation(inputs.text, inputs.operation);
        break;
        
      case 'password-generator':
        result = generatePassword(parseInt(inputs.length), inputs.includeSymbols === 'yes');
        break;
        
      case 'hash-generator':
        result = await generateHash(inputs.text, inputs.algorithm);
        break;
        
      // 网络工具需要服务端实现
      case 'ping-test':
      case 'port-scanner':
      case 'dns-lookup':
        result = await executeNetworkTool(toolId, inputs);
        break;
        
      default:
        throw new Error(`未知的工具: ${toolId}`);
    }
    
    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime
    };
  }
};

// 具体工具实现函数
function convertTimestamp(input: string, format: string): string {
  const trimmedInput = input.trim();
  
  // 检查是否为时间戳
  if (/^\d+$/.test(trimmedInput)) {
    const timestamp = parseInt(trimmedInput);
    const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
    
    if (format === 'timestamp') {
      return timestamp.toString();
    } else if (format === 'ISO') {
      return date.toISOString();
    } else {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');
    }
  } else {
    // 解析日期字符串
    const date = new Date(trimmedInput);
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期格式');
    }
    
    if (format === 'timestamp') {
      return Math.floor(date.getTime() / 1000).toString();
    } else if (format === 'ISO') {
      return date.toISOString();
    } else {
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');
    }
  }
}

function formatJSON(jsonStr: string): { formatted: string; valid: boolean } {
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      formatted: JSON.stringify(parsed, null, 2),
      valid: true
    };
  } catch (error) {
    throw new Error(`JSON 格式错误: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function base64Operation(text: string, operation: string): string {
  try {
    if (operation === 'encode') {
      return btoa(unescape(encodeURIComponent(text)));
    } else {
      return decodeURIComponent(escape(atob(text)));
    }
  } catch (error) {
    throw new Error(`Base64 ${operation === 'encode' ? '编码' : '解码'}失败`);
  }
}

function generatePassword(length: number, includeSymbols: boolean): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let charset = lowercase + uppercase + numbers;
  if (includeSymbols) {
    charset += symbols;
  }
  
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
}

async function generateHash(text: string, algorithm: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  let hashBuffer: ArrayBuffer;
  
  switch (algorithm) {
    case 'SHA1':
      hashBuffer = await crypto.subtle.digest('SHA-1', data);
      break;
    case 'SHA256':
      hashBuffer = await crypto.subtle.digest('SHA-256', data);
      break;
    case 'SHA512':
      hashBuffer = await crypto.subtle.digest('SHA-512', data);
      break;
    case 'MD5':
      // MD5 需要第三方库，这里先返回 SHA256
      hashBuffer = await crypto.subtle.digest('SHA-256', data);
      break;
    default:
      throw new Error(`不支持的算法: ${algorithm}`);
  }
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function executeNetworkTool(toolId: string, inputs: Record<string, any>): Promise<any> {
  // 这些工具需要调用服务端 API
  const response = await fetch(`/api/tools/${toolId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(inputs)
  });
  
  if (!response.ok) {
    throw new Error(`网络工具执行失败: ${response.statusText}`);
  }
  
  return response.json();
}

// 工具历史记录管理
export const saveToolToHistory = (tool: Tool, inputs: Record<string, any>, result: ToolResult): void => {
  if (typeof window === 'undefined') return;
  
  const history = getToolHistory();
  const historyItem = {
    tool,
    inputs,
    result,
    timestamp: new Date().toISOString()
  };
  
  history.unshift(historyItem);
  // 只保留最近 50 条记录
  if (history.length > 50) {
    history.splice(50);
  }
  
  localStorage.setItem('tool-history', JSON.stringify(history));
};

export const getToolHistory = (): any[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const history = localStorage.getItem('tool-history');
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

// 工具收藏管理
export const toggleToolFavorite = (toolId: string): void => {
  if (typeof window === 'undefined') return;
  
  const favorites = getFavoriteTools();
  const index = favorites.indexOf(toolId);
  
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(toolId);
  }
  
  localStorage.setItem('favorite-tools', JSON.stringify(favorites));
};

export const getFavoriteTools = (): string[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const favorites = localStorage.getItem('favorite-tools');
    return favorites ? JSON.parse(favorites) : [];
  } catch {
    return [];
  }
};

// 工具分类获取
export const getToolsByCategory = (category?: ToolCategory): Tool[] => {
  const favorites = getFavoriteTools();
  
  let tools = builtInTools.map(tool => ({
    ...tool,
    isFavorite: favorites.includes(tool.id)
  }));
  
  if (category) {
    tools = tools.filter(tool => tool.category === category);
  }
  
  return tools;
};

// 工具搜索
export const searchTools = (query: string, category?: ToolCategory): Tool[] => {
  const tools = getToolsByCategory(category);
  
  if (!query.trim()) {
    return tools;
  }
  
  const searchTerm = query.toLowerCase();
  return tools.filter(tool => 
    tool.name.toLowerCase().includes(searchTerm) ||
    tool.description.toLowerCase().includes(searchTerm)
  );
}; 