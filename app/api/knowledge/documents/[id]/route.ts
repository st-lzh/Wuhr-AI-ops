import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../../lib/config/database'
import { chunkRunbook, estimateTokens, hashRunbookContent, MAX_RUNBOOK_SIZE, normalizeTags } from '../../../../../lib/knowledge/runbookService'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  content: z.string().trim().min(1).max(MAX_RUNBOOK_SIZE),
  tags: z.array(z.string().max(50)).max(30).default([])
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'improve:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const document = await prisma.runbookDocument.findFirst({ where: { id: params.id, status: 'active' }, include: { _count: { select: { chunks: true } } } })
  if (!document) return NextResponse.json({ success: false, error: '知识文档不存在' }, { status: 404 })
  return NextResponse.json({ success: true, data: document })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'improve:write')
  if (!auth.success) return auth.response
  try {
    const data = updateSchema.parse(await request.json())
    const prisma = await getPrismaClient()
    if (!await prisma.runbookDocument.count({ where: { id: params.id, status: 'active' } })) return NextResponse.json({ success: false, error: '知识文档不存在' }, { status: 404 })
    const contentHash = hashRunbookContent(data.content)
    const chunks = chunkRunbook(data.content)
    const document = await prisma.$transaction(async tx => {
      await tx.runbookChunk.deleteMany({ where: { documentId: params.id } })
      return tx.runbookDocument.update({
        where: { id: params.id },
        data: {
          ...data, tags: normalizeTags(data.tags), contentHash,
          chunks: { create: chunks.map((content, chunkIndex) => ({ content, chunkIndex, tokenCount: estimateTokens(content) })) }
        },
        include: { _count: { select: { chunks: true } } }
      })
    })
    await prisma.systemLog.create({ data: { level: 'info', category: 'knowledge', message: `更新知识文档：${document.title}`, source: 'knowledge-api', userId: auth.user.id, details: { documentId: document.id, chunkCount: chunks.length } } })
    return NextResponse.json({ success: true, data: { ...document, content: undefined } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '更新知识文档失败' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'improve:write')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const document = await prisma.runbookDocument.findUnique({ where: { id: params.id }, select: { id: true, title: true } })
  if (!document) return NextResponse.json({ success: false, error: '知识文档不存在' }, { status: 404 })
  await prisma.runbookDocument.delete({ where: { id: params.id } })
  await prisma.systemLog.create({ data: { level: 'warn', category: 'knowledge', message: `删除知识文档：${document.title}`, source: 'knowledge-api', userId: auth.user.id, details: { documentId: document.id } } })
  return NextResponse.json({ success: true })
}
