// /api/improve/outcomes/export — 导出 outcomes 为 CSV / JSON
// 代理保留后端 Content-Type 和 Content-Disposition，浏览器自动触发下载

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return proxyToImproveBackend(request, {
    path: '/api/v1/improve/outcomes/export',
    timeoutMs: 60_000, // 大数据集导出留宽
  })
}
