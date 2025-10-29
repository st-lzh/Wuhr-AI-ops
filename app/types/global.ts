// 全局状态管理类型定义

export type Theme = 'dark' | 'light'

export interface UserInfo {
  id?: string
  name?: string
  email?: string
  avatar?: string
  role?: string
}

// ======================== 认证相关类型 ========================

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'manager' | 'developer' | 'viewer'
  permissions: string[]
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
  avatar?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  accessToken: string | null
  permissions: string[]
  loading: boolean
  error: string | null
  lastLoginAt?: Date
  sessionExpiresAt?: Date
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface ApiKeyConfig {
  id: string
  name: string
  key: string
  baseUrl?: string
  isDefault?: boolean
  provider?: 'openai-compatible' | 'deepseek' | 'gemini'
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface ModelConfig {
  id: string
  name: string
  displayName: string
  provider: string
  maxTokens?: number
  temperature?: number
  isDefault?: boolean
}

export interface UserPreferences {
  language: 'zh-CN' | 'en-US'
  autoSave: boolean
  notifications: boolean
  soundEnabled: boolean
  compactMode: boolean
}

export interface GlobalState {
  // 主题设置
  theme: Theme
  
  // 用户信息（保留向后兼容）
  user: UserInfo | null
  
  // 认证状态
  auth: AuthState
  
  // API 配置
  apiKeys: ApiKeyConfig[]
  selectedApiKey: string | null
  
  // 模型配置
  models: ModelConfig[]
  selectedModel: string | null
  
  // 用户偏好
  preferences: UserPreferences
  
  // 系统状态
  loading: boolean
  loadingStates?: Record<string, boolean>
  error: string | null
}

export type GlobalAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_USER'; payload: UserInfo | null }
  // 认证相关Actions
  | { type: 'AUTH_LOGIN_START' }
  | { type: 'AUTH_LOGIN_SUCCESS'; payload: { user: AuthUser; accessToken: string; expiresIn: number } }
  | { type: 'AUTH_LOGIN_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_REFRESH_TOKEN_SUCCESS'; payload: { accessToken: string; expiresIn: number } }
  | { type: 'AUTH_UPDATE_USER'; payload: Partial<AuthUser> }
  | { type: 'AUTH_UPDATE_PERMISSIONS'; payload: string[] }
  | { type: 'AUTH_SET_LOADING'; payload: boolean }
  | { type: 'AUTH_SET_ERROR'; payload: string | null }
  | { type: 'AUTH_CHECK_SESSION' }
  | { type: 'AUTH_SESSION_EXPIRED' }
  // 原有Actions
  | { type: 'SET_API_KEYS'; payload: ApiKeyConfig[] }
  | { type: 'ADD_API_KEY'; payload: ApiKeyConfig }
  | { type: 'UPDATE_API_KEY'; payload: ApiKeyConfig }
  | { type: 'DELETE_API_KEY'; payload: string }
  | { type: 'SET_SELECTED_API_KEY'; payload: string | null }
  | { type: 'ADD_MODEL'; payload: ModelConfig }
  | { type: 'UPDATE_MODEL'; payload: ModelConfig }
  | { type: 'DELETE_MODEL'; payload: string }
  | { type: 'SET_SELECTED_MODEL'; payload: string }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'SET_LOADING'; payload: { loading: boolean; key?: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<GlobalState> }

export interface GlobalContextType {
  state: GlobalState
  dispatch: React.Dispatch<GlobalAction>
} 