'use client'

import { useGlobalState } from '../contexts/GlobalStateContext'
import { Theme, ApiKeyConfig, ModelConfig, UserPreferences } from '../types/global'

// 主题管理 Hook
export const useTheme = () => {
  const { state, dispatch } = useGlobalState()
  
  const setTheme = (theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme })
  }
  
  const toggleTheme = () => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }
  
  return {
    theme: state.theme,
    setTheme,
    toggleTheme,
    isDark: state.theme === 'dark',
    isLight: state.theme === 'light'
  }
}

// API 配置管理 Hook
export const useApiConfig = () => {
  const { state, dispatch } = useGlobalState()
  
  const addApiKey = (apiKey: ApiKeyConfig) => {
    dispatch({ type: 'ADD_API_KEY', payload: apiKey })
  }
  
  const updateApiKey = (apiKey: ApiKeyConfig) => {
    dispatch({ type: 'UPDATE_API_KEY', payload: apiKey })
  }
  
  const deleteApiKey = (id: string) => {
    dispatch({ type: 'DELETE_API_KEY', payload: id })
  }
  
  const selectApiKey = (id: string) => {
    dispatch({ type: 'SET_SELECTED_API_KEY', payload: id })
  }
  
  const getSelectedApiKey = () => {
    return state.apiKeys.find(key => key.id === state.selectedApiKey) || null
  }
  
  const getDefaultApiKey = () => {
    return state.apiKeys.find(key => key.isDefault) || state.apiKeys[0] || null
  }
  
  return {
    apiKeys: state.apiKeys,
    selectedApiKey: state.selectedApiKey,
    selectedApiKeyConfig: getSelectedApiKey(),
    defaultApiKey: getDefaultApiKey(),
    addApiKey,
    updateApiKey,
    deleteApiKey,
    selectApiKey
  }
}

// 模型配置管理 Hook
export const useModelConfig = () => {
  const { state, dispatch } = useGlobalState()
  
  const addModel = (model: ModelConfig) => {
    dispatch({ type: 'ADD_MODEL', payload: model })
  }
  
  const updateModel = (model: ModelConfig) => {
    dispatch({ type: 'UPDATE_MODEL', payload: model })
  }
  
  const deleteModel = (id: string) => {
    dispatch({ type: 'DELETE_MODEL', payload: id })
  }
  
  const selectModel = (id: string) => {
    dispatch({ type: 'SET_SELECTED_MODEL', payload: id })
  }
  
  const getSelectedModel = () => {
    return state.models.find(model => model.id === state.selectedModel) || null
  }
  
  const getDefaultModel = () => {
    return state.models.find(model => model.isDefault) || state.models[0] || null
  }
  
  const getModelsByProvider = (provider: string) => {
    return state.models.filter(model => model.provider === provider)
  }
  
  return {
    models: state.models,
    selectedModel: state.selectedModel,
    selectedModelConfig: getSelectedModel(),
    defaultModel: getDefaultModel(),
    addModel,
    updateModel,
    deleteModel,
    selectModel,
    getModelsByProvider
  }
}

// 用户偏好管理 Hook
export const usePreferences = () => {
  const { state, dispatch } = useGlobalState()
  
  const updatePreferences = (preferences: Partial<UserPreferences>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences })
  }
  
  const resetPreferences = () => {
    const defaultPreferences: UserPreferences = {
      language: 'zh-CN',
      autoSave: true,
      notifications: true,
      soundEnabled: false,
      compactMode: false
    }
    updatePreferences(defaultPreferences)
  }
  
  return {
    preferences: state.preferences,
    updatePreferences,
    resetPreferences
  }
}

// 加载状态管理 Hook
export const useLoading = () => {
  const { state, dispatch } = useGlobalState()
  
  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { loading } })
  }
  
  return {
    isLoading: state.loading,
    setLoading
  }
}

// 错误状态管理 Hook
export const useError = () => {
  const { state, dispatch } = useGlobalState()
  
  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }
  
  const clearError = () => {
    setError(null)
  }
  
  return {
    error: state.error,
    hasError: !!state.error,
    setError,
    clearError
  }
}

// 用户信息管理 Hook
export const useUser = () => {
  const { state, dispatch } = useGlobalState()
  
  const setUser = (user: any) => {
    dispatch({ type: 'SET_USER', payload: user })
  }
  
  const logout = () => {
    setUser(null)
  }
  
  return {
    user: state.user,
    isAuthenticated: !!state.user,
    setUser,
    logout
  }
}

// 重置状态 Hook
export const useResetState = () => {
  const { dispatch } = useGlobalState()
  
  const resetState = () => {
    dispatch({ type: 'RESET_STATE' })
  }
  
  return { resetState }
}

// 导出主要的 hook
export { useGlobalState } from '../contexts/GlobalStateContext' 