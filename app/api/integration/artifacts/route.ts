import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { protectSecret } from '../../../../lib/crypto/encryption'

export const dynamic = 'force-dynamic'

const repositorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  repositoryType: z.enum(['docker_registry', 'harbor']).default('docker_registry'),
  baseUrl: z.string().url().max(500).refine(value => /^https?:\/\//.test(value), '只支持 HTTP 或 HTTPS 地址'),
  projectName: z.string().max(255).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  password: z.string().max(2000).optional().nullable(),
  verifyTls: z.boolean().default(true),
  isDefault: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'cicd:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const repositories = await prisma.artifactRepository.findMany({
    select: {
      id: true, name: true, repositoryType: true, baseUrl: true, projectName: true,
      username: true, verifyTls: true, isDefault: true, status: true,
      lastVerifiedAt: true, lastError: true, createdAt: true, updatedAt: true,
      passwordEncrypted: true
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
  })
  return NextResponse.json({ success: true, data: repositories.map(({ passwordEncrypted, ...item }) => ({ ...item, hasPassword: Boolean(passwordEncrypted) })) })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'cicd:write')
  if (!auth.success) return auth.response
  try {
    const data = repositorySchema.parse(await request.json())
    const prisma = await getPrismaClient()
    const repository = await prisma.$transaction(async tx => {
      if (data.isDefault) await tx.artifactRepository.updateMany({ data: { isDefault: false } })
      return tx.artifactRepository.create({
        data: {
          name: data.name, repositoryType: data.repositoryType, baseUrl: data.baseUrl.replace(/\/$/, ''),
          projectName: data.projectName, username: data.username,
          passwordEncrypted: data.password ? protectSecret(data.password) : null,
          verifyTls: data.verifyTls, isDefault: data.isDefault, createdById: auth.user.id
        },
        select: { id: true, name: true, repositoryType: true, baseUrl: true, projectName: true, username: true, verifyTls: true, isDefault: true, status: true, createdAt: true }
      })
    })
    await prisma.systemLog.create({ data: { level: 'info', category: 'artifact_repository', message: `创建制品仓库：${repository.name}`, source: 'integration-api', userId: auth.user.id, details: { repositoryId: repository.id, repositoryType: repository.repositoryType, baseUrl: repository.baseUrl } } })
    return NextResponse.json({ success: true, data: repository }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建制品仓库失败' }, { status: 400 })
  }
}
