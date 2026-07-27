// /api/improve/patches/propose — 起草 skill 补丁提案
// body: { min_failures?, window_days? }

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, {
    path: '/api/v1/improve/patches/propose',
    requireWrite: true,
    timeoutMs: 2 * 60 * 1000,
  })
}
