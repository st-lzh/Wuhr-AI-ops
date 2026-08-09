'use client'

import React from 'react'
import MainLayout from '../../components/layout/MainLayout'
import SystemChat from '../../components/ai/SystemChat'

export default function SystemPage() {
  return (
    <div className="h-dvh min-h-0 overflow-hidden">
      <MainLayout>
        <div className="h-[calc(100dvh-112px)] min-h-0 overflow-hidden">
          <SystemChat />
        </div>
      </MainLayout>
    </div>
  )
}
