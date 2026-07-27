// /api/improve/proposed/[id]/reject — 拒绝提案（防反思器重复提）
// body: { reason } 必填

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/proposed/${encodeURIComponent(params.id)}/reject`,
    requireWrite: true,
  })
}
