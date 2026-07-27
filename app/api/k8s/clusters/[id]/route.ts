import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'servers:write'); if (!auth.success) return auth.response
  const prisma = await getPrismaClient(); const cluster = await prisma.k8sCluster.delete({ where: { id: params.id } }).catch(() => null)
  if (!cluster) return NextResponse.json({ success: false, error: '集群不存在' }, { status: 404 })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'k8s_cluster', message: `移除集群：${cluster.name}`, source: 'k8s-api', userId: auth.user.id, details: { clusterId: cluster.id } } })
  return NextResponse.json({ success: true })
}
