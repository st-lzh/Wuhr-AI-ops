// /api/improve/proposed/[id]/approve — 批准提案 → 转 lesson 入库
// body: { reason? }

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/proposed/${encodeURIComponent(params.id)}/approve`,
    requireWrite: true,
  })
}
