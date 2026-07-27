// /api/improve/reflect/status — 拉自动反思的最新状态

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/reflect/status' })
}
