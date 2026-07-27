// /api/improve/skills/[name]/source — file skill 原始 YAML 源码
//
// GET: 读取原始 YAML（builtin → 422）
// PUT: 校验 + 原子写 + reload（admin 权限）

import { NextRequest } from 'next/server'
import { proxyToImproveBackend } from '../../../../../../lib/improve/backendProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { name: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/skills/${encodeURIComponent(params.name)}/source`,
  })
}

export async function PUT(request: NextRequest, { params }: { params: { name: string } }) {
  return proxyToImproveBackend(request, {
    path: `/api/v1/improve/skills/${encodeURIComponent(params.name)}/source`,
    requireWrite: true,
  })
}
