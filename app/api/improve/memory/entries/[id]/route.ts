// /api/improve/memory/entries/[id] — 按 ID 删除单条

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/memory/entries/${encodeURIComponent(params.id)}`,
    requireWrite: true,
  })
}
