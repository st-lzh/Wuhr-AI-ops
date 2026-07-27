import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { revealSecret } from '../../../../../../lib/crypto/encryption'
import { executeSSHCommand } from '../../../../../../lib/ssh/client'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'servers:write'); if (!auth.success) return auth.response
  const prisma = await getPrismaClient(); const cluster = await prisma.k8sCluster.findUnique({ where: { id: params.id } })
  if (!cluster) return NextResponse.json({ success: false, error: '集群不存在' }, { status: 404 })
  const server = await prisma.server.findUnique({ where: { id: cluster.serverId } })
  if (!server) return NextResponse.json({ success: false, error: 'Agent 主机不存在' }, { status: 404 })
  const command = `kubectl --context ${cluster.contextName} version -o json && kubectl --context ${cluster.contextName} get namespace ${cluster.defaultNamespace} -o name`
  try {
    const result = await executeSSHCommand({ host: server.ip, port: server.port, username: server.username, password: revealSecret(server.password) || undefined, privateKey: server.keyPath || undefined, timeout: 20_000 }, command)
    const versionMatch = result.stdout.match(/"gitVersion"\s*:\s*"([^"]+)"/g)
    const version = versionMatch?.at(-1)?.match(/"([^"]+)"$/)?.[1]
    await prisma.k8sCluster.update({ where: { id: cluster.id }, data: { status: result.success ? 'online' : 'error', kubernetesVersion: version, lastVerifiedAt: new Date(), lastError: result.success ? null : result.stderr } })
    await prisma.systemLog.create({ data: { level: result.success ? 'info' : 'error', category: 'k8s_cluster', message: `集群验证${result.success ? '成功' : '失败'}：${cluster.name}`, source: 'k8s-api', userId: auth.user.id, details: { clusterId: cluster.id, exitCode: result.code } } })
    return NextResponse.json({ success: result.success, data: { version, namespace: cluster.defaultNamespace, output: result.stdout }, error: result.success ? undefined : result.stderr }, { status: result.success ? 200 : 502 })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error); await prisma.k8sCluster.update({ where: { id: cluster.id }, data: { status: 'error', lastVerifiedAt: new Date(), lastError: text } })
    return NextResponse.json({ success: false, error: text }, { status: 502 })
  }
}
