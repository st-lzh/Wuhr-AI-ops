// /api/improve/lessons — 列表 / 创建
// 透传到后端 /api/v1/improve/lessons
//
// GET 查询参数：skill, cluster, project, q, top_k
// POST body: { skill_pattern, text, severity, scope_project, scope_cluster, ... }

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/lessons' })
}

export async function POST(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/lessons', requireWrite: true })
}
