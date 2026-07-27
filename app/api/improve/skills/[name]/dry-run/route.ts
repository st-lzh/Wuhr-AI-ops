// /api/improve/skills/[name]/dry-run — 渲染 skill 命令但不执行
// body: { args: {...} }
// 不强制 admin role：dry-run 是只读操作

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { name: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/skills/${encodeURIComponent(params.name)}/dry-run`,
    requireWrite: false, // dry-run 只读
  })
}
