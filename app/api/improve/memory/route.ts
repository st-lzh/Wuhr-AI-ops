// /api/improve/memory — long-term 记忆条目（按 type/project/cluster 过滤）
// GET 查询参数：type, project, cluster
// POST body: { content, type?, project?, cluster? }

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/memory' })
}

export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/memory', requireWrite: true })
}
