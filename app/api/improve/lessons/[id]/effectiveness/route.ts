// /api/improve/lessons/[id]/effectiveness — 度量 lesson 入库后是否真减少了相关失败

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/lessons/${encodeURIComponent(params.id)}/effectiveness`,
  })
}
