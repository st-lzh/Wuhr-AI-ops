// /api/improve/lessons/effectiveness — 批量度量所有 lesson 的效果
// （列表页用，避免 N+1）

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/lessons/effectiveness' })
}
