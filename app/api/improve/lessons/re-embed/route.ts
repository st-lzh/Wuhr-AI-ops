// /api/improve/lessons/re-embed — 批量重算 lesson embedding（切模型时用）
// body: { base_url, api_key, model }
// 同步执行，可能慢；超时调大到 5 分钟

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, {
    path: '/api/v1/improve/lessons/re-embed',
    requireWrite: true,
    timeoutMs: 5 * 60 * 1000,
  })
}
