import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../../lib/config/database'
import { revealSecret } from '../../../../../../lib/crypto/encryption'
import { checkDockerRegistry } from '../../../../../../lib/artifacts/registryClient'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'cicd:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const repository = await prisma.artifactRepository.findUnique({ where: { id: params.id } })
  if (!repository) return NextResponse.json({ success: false, error: '制品仓库不存在' }, { status: 404 })
  const result = await checkDockerRegistry({
    baseUrl: repository.baseUrl,
    username: repository.username,
    password: repository.passwordEncrypted ? revealSecret(repository.passwordEncrypted) : undefined,
    verifyTls: repository.verifyTls
  })
  await prisma.artifactRepository.update({ where: { id: repository.id }, data: { status: result.ok ? 'online' : 'error', lastVerifiedAt: new Date(), lastError: result.error || null } })
  await prisma.systemLog.create({ data: { level: result.ok ? 'info' : 'error', category: 'artifact_repository', message: `测试制品仓库 ${repository.name}：${result.ok ? '成功' : '失败'}`, source: 'integration-api', userId: auth.user.id, details: { repositoryId: repository.id, statusCode: result.statusCode, latencyMs: result.latencyMs, error: result.error } } })
  return NextResponse.json({ success: result.ok, data: result, error: result.error }, { status: result.ok ? 200 : 502 })
}
