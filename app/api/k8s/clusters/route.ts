import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2).max(120), serverId: z.string().min(1),
  contextName: z.string().regex(/^[A-Za-z0-9._/@:-]+$/),
  defaultNamespace: z.string().regex(/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/).default('default'),
  environment: z.string().max(50).optional(), description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(30).default([])
})

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:read'); if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const clusters = await prisma.k8sCluster.findMany({ orderBy: { name: 'asc' } })
  const servers = await prisma.server.findMany({ where: { id: { in: clusters.map(item => item.serverId) } }, select: { id: true, name: true, ip: true, status: true } })
  return NextResponse.json({ success: true, data: clusters.map(cluster => ({ ...cluster, server: servers.find(server => server.id === cluster.serverId) })) })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:write'); if (!auth.success) return auth.response
  try {
    const data = schema.parse(await request.json()); const prisma = await getPrismaClient()
    if (!await prisma.server.count({ where: { id: data.serverId, isActive: true } })) return NextResponse.json({ success: false, error: 'Agent 主机不存在或已停用' }, { status: 400 })
    const cluster = await prisma.k8sCluster.create({ data: { ...data, createdById: auth.user.id } })
    await prisma.systemLog.create({ data: { level: 'info', category: 'k8s_cluster', message: `登记集群：${cluster.name}`, source: 'k8s-api', userId: auth.user.id, details: { clusterId: cluster.id, contextName: cluster.contextName, serverId: cluster.serverId } } })
    return NextResponse.json({ success: true, data: cluster }, { status: 201 })
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '登记集群失败' }, { status: 400 }) }
}
