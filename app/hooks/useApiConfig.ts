import { useState, useEffect } from 'react'

export interface ApiProvider {
  id: string
  name: string
  type: string
  baseUrl?: string
  apiKey: string
  isDefault?: boolean
  isActive?: boolean
}

export function useApiConfig() {
  const [providers, setProviders] = useState<ApiProvider[]>([])
  const [currentProvider, setCurrentProvider] = useState<ApiProvider | null>(null)
  const [loading, setLoading] = useState(false)

  // 获取API配置
  const fetchApiConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/config/api-keys', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const apiProviders = data.apiKeys || []
        setProviders(apiProviders)
        
        // 设置默认提供商
        const defaultProvider = apiProviders.find((p: ApiProvider) => p.isDefault) || apiProviders[0]
        setCurrentProvider(defaultProvider || null)
      }
    } catch (error) {
      console.error('获取API配置失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApiConfig()
  }, [])

  return {
    providers,
    currentProvider,
    setCurrentProvider,
    loading,
    refresh: fetchApiConfig
  }
}
