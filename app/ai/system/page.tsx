'use client'

import React from 'react'
import MainLayout from '../../components/layout/MainLayout'
import SystemChat from '../../components/ai/SystemChat'

export default function SystemPage() {
  return (
    <div className="h-screen overflow-hidden">
      <MainLayout>
        <div className="h-full overflow-hidden">
          <SystemChat />
        </div>
      </MainLayout>
    </div>
  )
}