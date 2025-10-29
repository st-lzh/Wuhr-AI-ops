'use client'

import React, { createContext, useContext, useCallback, useState } from 'react'

interface DataLoadingContextType {
  // 服务器数据加载状态
  serversLoaded: boolean
  setServersLoaded: (loaded: boolean) => void
  
  // 服务器组数据加载状态
  serverGroupsLoaded: boolean
  setServerGroupsLoaded: (loaded: boolean) => void
  
  // 模型数据加载状态
  modelsLoaded: boolean
  setModelsLoaded: (loaded: boolean) => void
  
  // 重置所有加载状态
  resetLoadingStates: () => void
  
  // 获取数据加载统计
  getLoadingStats: () => {
    totalLoaded: number
    totalItems: number
    percentage: number
  }
}

const DataLoadingContext = createContext<DataLoadingContextType | undefined>(undefined)

export function DataLoadingProvider({ children }: { children: React.ReactNode }) {
  const [serversLoaded, setServersLoaded] = useState(false)
  const [serverGroupsLoaded, setServerGroupsLoaded] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  const resetLoadingStates = useCallback(() => {
    setServersLoaded(false)
    setServerGroupsLoaded(false)
    setModelsLoaded(false)
  }, [])

  const getLoadingStats = useCallback(() => {
    const loaded = [serversLoaded, serverGroupsLoaded, modelsLoaded]
    const totalLoaded = loaded.filter(Boolean).length
    const totalItems = loaded.length
    const percentage = totalItems > 0 ? Math.round((totalLoaded / totalItems) * 100) : 0
    
    return { totalLoaded, totalItems, percentage }
  }, [serversLoaded, serverGroupsLoaded, modelsLoaded])

  const value: DataLoadingContextType = {
    serversLoaded,
    setServersLoaded,
    serverGroupsLoaded,
    setServerGroupsLoaded,
    modelsLoaded,
    setModelsLoaded,
    resetLoadingStates,
    getLoadingStats
  }

  return (
    <DataLoadingContext.Provider value={value}>
      {children}
    </DataLoadingContext.Provider>
  )
}

export function useDataLoading() {
  const context = useContext(DataLoadingContext)
  if (context === undefined) {
    throw new Error('useDataLoading must be used within a DataLoadingProvider')
  }
  return context
}

export default DataLoadingContext