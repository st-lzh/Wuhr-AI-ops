// /api/improve/outcomes — skill 执行历史（按时间倒序）
// 查询参数：since_seconds, skill, status, limit

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, { path: '/api/v1/improve/outcomes' })
}
