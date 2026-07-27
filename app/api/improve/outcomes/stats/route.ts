// /api/improve/outcomes/stats — 聚合统计（total / success / failure / TopK skill）

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/outcomes/stats' })
}
