// /api/improve/proposed — 提案队列列表
// 查询参数：status=pending|approved|rejected|all（默认 pending）

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/proposed' })
}
