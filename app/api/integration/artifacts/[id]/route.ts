import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { protectSecret } from '../../../../../lib/crypto/encryption'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  baseUrl: z.string().url().max(500).refine(value => /^https?:\/\//.test(value), '只支持 HTTP 或 HTTPS 地址').optional(),
  projectName: z.string().max(255).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  password: z.string().max(2000).optional().nullable(),
  verifyTls: z.boolean().optional(),
  isDefault: z.boolean().optional()
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'cicd:write')
  if (!auth.success) return auth.response
  try {
    const data = schema.parse(await request.json())
    const { password, ...fields } = data
    const prisma = await getPrismaClient()
    const repository = await prisma.$transaction(async tx => {
      if (data.isDefault) await tx.artifactRepository.updateMany({ where: { id: { not: params.id } }, data: { isDefault: false } })
      return tx.artifactRepository.update({
        where: { id: params.id },
        data: {
          ...fields,
          ...(data.baseUrl ? { baseUrl: data.baseUrl.replace(/\/$/, '') } : {}),
          ...(password !== undefined ? { passwordEncrypted: password ? protectSecret(password) : null } : {}),
          status: 'unknown', lastError: null
        },
        select: { id: true, name: true, repositoryType: true, baseUrl: true, projectName: true, username: true, verifyTls: true, isDefault: true, status: true, updatedAt: true }
      })
    })
    await prisma.systemLog.create({ data: { level: 'warn', category: 'artifact_repository', message: `更新制品仓库：${repository.name}`, source: 'integration-api', userId: auth.user.id, details: { repositoryId: repository.id } } })
    return NextResponse.json({ success: true, data: repository })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '更新制品仓库失败' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'cicd:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const repository = await prisma.artifactRepository.findUnique({ where: { id: params.id }, select: { id: true, name: true } })
  if (!repository) return NextResponse.json({ success: false, error: '制品仓库不存在' }, { status: 404 })
  await prisma.artifactRepository.delete({ where: { id: params.id } })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'artifact_repository', message: `删除制品仓库：${repository.name}`, source: 'integration-api', userId: auth.user.id, details: { repositoryId: repository.id } } })
  return NextResponse.json({ success: true })
}
