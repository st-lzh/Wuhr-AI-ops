// /api/improve/patches/[id] — 补丁提案详情

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/patches/${encodeURIComponent(params.id)}`,
  })
}
