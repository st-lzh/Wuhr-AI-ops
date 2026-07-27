// /api/improve/skills — 技能列表（含 builtin + file skills 元信息）
// 查询参数：category, search

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/skills' })
}

// POST /api/improve/skills — 新建 file skill
export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/skills' })
}
