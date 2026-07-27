// /api/improve/skills/[name] — 单个 skill 详情（含 executor.Command 源码）

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/skills/${encodeURIComponent(params.name)}`,
  })
}
