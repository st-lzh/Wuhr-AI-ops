// /api/improve/reflect — 触发反思器
// body: { since_seconds?: number, min_failures?: number }
// 同步执行，可能慢；超时 2 分钟

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, {
    path: '/api/v1/improve/reflect',
    requireWrite: true,
    timeoutMs: 2 * 60 * 1000,
  })
}
