'use client'

import React, { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react'
import { GlobalState, GlobalAction, GlobalContextType, ApiKeyConfig, ModelConfig, AuthState } from '../types/global'

// 默认认证状态
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  permissions: [],
  loading: false,
  error: null,
  lastLoginAt: undefined,
  sessionExpiresAt: undefined
}

// 首屏必须先校验 httpOnly Cookie，不能让 AuthGuard 在校验完成前误判为未登录。
const initialAuthState: AuthState = {
  ...defaultAuthState,
  loading: true
}

// 默认状态
const defaultState: GlobalState = {
  theme: 'dark',
  user: null,
  // 认证状态
  auth: initialAuthState,
  apiKeys: [],
  selectedApiKey: null,
  models: [
    {
      id: 'gpt-4o',
      name: 'gpt-4o',
      displayName: 'GPT-4o (推荐)',
      provider: 'openai-compatible',
      maxTokens: 4000,
      temperature: 0.7,
      isDefault: true
    },
    {
      id: 'gpt-4',
      name: 'gpt-4',
      displayName: 'GPT-4',
      provider: 'openai-compatible',
      maxTokens: 8000,
      temperature: 0.7
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      provider: 'openai-compatible',
      maxTokens: 4000,
      temperature: 0.7
    }
  ],
  selectedModel: 'gpt-4o',
  preferences: {
    language: 'zh-CN',
    autoSave: true,
    notifications: true,
    soundEnabled: false,
    compactMode: false
  },
  loading: false,
  error: null
}

// Reducer 函数
function globalReducer(state: GlobalState, action: GlobalAction): GlobalState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    
    case 'SET_USER':
      return { ...state, user: action.payload }

    // 认证相关Actions
    case 'AUTH_LOGIN_START':
      return {
        ...state,
        auth: {
          ...state.auth,
          loading: true,
          error: null
        }
      }

    case 'AUTH_LOGIN_SUCCESS':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          user: action.payload.user,
          accessToken: action.payload.accessToken,
          permissions: action.payload.user.permissions || [],
          sessionExpiresAt: new Date(Date.now() + action.payload.expiresIn * 1000),
          lastLoginAt: new Date(),
          loading: false,
          error: null
        }
      }

    case 'AUTH_LOGIN_FAILURE':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: false,
          user: null,
          accessToken: null,
          permissions: [],
          sessionExpiresAt: undefined,
          lastLoginAt: undefined,
          loading: false,
          error: action.payload
        }
      }

    case 'AUTH_LOGOUT':
      return {
        ...state,
        auth: {
          ...defaultAuthState
        }
      }

    case 'AUTH_REFRESH_TOKEN_SUCCESS':
      return {
        ...state,
        auth: {
          ...state.auth,
          accessToken: action.payload.accessToken,
          sessionExpiresAt: new Date(Date.now() + action.payload.expiresIn * 1000),
          loading: false,
          error: null
        }
      }

    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        auth: {
          ...state.auth,
          user: state.auth.user ? { ...state.auth.user, ...action.payload } : null
        }
      }

    case 'AUTH_UPDATE_PERMISSIONS':
      return {
        ...state,
        auth: {
          ...state.auth,
          permissions: action.payload
        }
      }

    case 'AUTH_SET_LOADING':
      return {
        ...state,
        auth: {
          ...state.auth,
          loading: action.payload
        }
      }

    case 'AUTH_SET_ERROR':
      return {
        ...state,
        auth: {
          ...state.auth,
          error: action.payload,
          loading: false
        }
      }

    case 'AUTH_CHECK_SESSION':
      return {
        ...state,
        auth: {
          ...state.auth,
          loading: true
        }
      }

    case 'AUTH_SESSION_EXPIRED':
      return {
        ...state,
        auth: {
          ...defaultAuthState,
          error: '会话已过期，请重新登录'
        }
      }

    case 'SET_API_KEYS':
      return {
        ...state,
        apiKeys: action.payload
      }

    case 'ADD_API_KEY':
      return {
        ...state,
        apiKeys: [...state.apiKeys, action.payload]
      }
    
    case 'UPDATE_API_KEY':
      return {
        ...state,
        apiKeys: state.apiKeys.map(key =>
          key.id === action.payload.id ? action.payload : key
        )
      }
    
    case 'DELETE_API_KEY':
      return {
        ...state,
        apiKeys: state.apiKeys.filter(key => key.id !== action.payload),
        selectedApiKey: state.selectedApiKey === action.payload ? null : state.selectedApiKey
      }
    
    case 'SET_SELECTED_API_KEY':
      return { ...state, selectedApiKey: action.payload }
    
    case 'ADD_MODEL':
      return {
        ...state,
        models: [...state.models, action.payload]
      }
    
    case 'UPDATE_MODEL':
      return {
        ...state,
        models: state.models.map(model =>
          model.id === action.payload.id ? action.payload : model
        )
      }
    
    case 'DELETE_MODEL':
      return {
        ...state,
        models: state.models.filter(model => model.id !== action.payload),
        selectedModel: state.selectedModel === action.payload ? null : state.selectedModel
      }
    
    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.payload }
    
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      }
    
    case 'SET_LOADING':
      const { loading, key } = action.payload
      if (key) {
        // 设置特定 key 的加载状态
        return {
          ...state,
          loadingStates: {
            ...state.loadingStates,
            [key]: loading
          }
        }
      } else {
        // 设置全局加载状态
        return { ...state, loading }
      }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    
    case 'RESET_STATE':
      return defaultState
    
    case 'LOAD_FROM_STORAGE':
      return { ...state, ...action.payload }
    
    default:
      return state
  }
}

// 创建 Context
export const GlobalStateContext = createContext<GlobalContextType | undefined>(undefined)

// localStorage 工具函数
const STORAGE_KEY = 'wuhr-ai-ops-state'

const saveToStorage = (state: GlobalState) => {
  try {
    if (typeof window === 'undefined') return // SSR 检查
    const stateToSave = {
      theme: state.theme,
      apiKeys: state.apiKeys,
      selectedApiKey: state.selectedApiKey,
      models: state.models,
      selectedModel: state.selectedModel,
      preferences: state.preferences,
      // 保存认证状态，但不保存敏感信息
      auth: {
        isAuthenticated: state.auth.isAuthenticated,
        user: state.auth.user,
        permissions: state.auth.permissions,
        lastLoginAt: state.auth.lastLoginAt,
        sessionExpiresAt: state.auth.sessionExpiresAt,
        // 不保存accessToken，需要重新验证
        accessToken: null,
        loading: false,
        error: null
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    console.log('💾 保存主题状态到localStorage:', state.theme)
  } catch (error) {
    console.error('保存状态到 localStorage 失败:', error)
  }
}

const loadFromStorage = (): Partial<GlobalState> | null => {
  try {
    if (typeof window === 'undefined') return null // SSR 检查
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('🔄 从localStorage加载主题状态:', parsed.theme)
      
      // 如果有认证状态，需要检查是否过期
      if (parsed.auth && parsed.auth.sessionExpiresAt) {
        const expiresAt = new Date(parsed.auth.sessionExpiresAt)
        const now = new Date()
        
        // 如果session已过期，清除认证状态
        if (expiresAt <= now) {
          console.log('🔄 Session已过期，清除认证状态')
          parsed.auth = {
            ...defaultAuthState
          }
        } else {
          // Session还未过期，恢复认证状态
          console.log('🔄 恢复有效的认证状态，过期时间:', expiresAt)
          parsed.auth.sessionExpiresAt = expiresAt
          parsed.auth.lastLoginAt = parsed.auth.lastLoginAt ? new Date(parsed.auth.lastLoginAt) : undefined
        }
      }

      // 本地状态不代表服务端会话仍有效；恢复后继续等待 AuthInitializer 校验 Cookie。
      if (parsed.auth) parsed.auth.loading = true
      
      return parsed
    }
  } catch (error) {
    console.error('从 localStorage 加载状态失败:', error)
  }
  return null
}

// Provider 组件
interface GlobalStateProviderProps {
  children: ReactNode
}

export const GlobalStateProvider: React.FC<GlobalStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(globalReducer, defaultState)
  const [isInitialized, setIsInitialized] = useState(false)

  // 初始化时从 localStorage 加载状态
  useEffect(() => {
    const storedState = loadFromStorage()
    if (storedState) {
      console.log('🔄 [GlobalStateProvider] 从localStorage恢复状态:', storedState)
      dispatch({ type: 'LOAD_FROM_STORAGE', payload: storedState })
    }
    setIsInitialized(true)
  }, [])

  // 状态变更时保存到 localStorage（但跳过初始化阶段）
  useEffect(() => {
    if (isInitialized) {
      saveToStorage(state)
      console.log('💾 [GlobalStateProvider] 保存状态到localStorage:', { theme: state.theme })
    }
  }, [state, isInitialized])

  return (
    <GlobalStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalStateContext.Provider>
  )
}

// 自定义 Hook
export const useGlobalState = () => {
  const context = useContext(GlobalStateContext)
  if (context === undefined) {
    throw new Error('useGlobalState 必须在 GlobalStateProvider 内部使用')
  }
  return context
}
