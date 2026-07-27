import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'
import { chunkRunbook, estimateTokens, hashRunbookContent, MAX_RUNBOOK_SIZE, normalizeTags } from '../../../../lib/knowledge/runbookService'

export const dynamic = 'force-dynamic'

const documentSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().max(2000).optional().nullable(),
  sourceType: z.enum(['manual', 'upload', 'incident', 'deployment']).default('manual'),
  sourceName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(100).optional().nullable(),
  content: z.string().trim().min(1).max(MAX_RUNBOOK_SIZE),
  tags: z.array(z.string().max(50)).max(30).default([])
})

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'improve:read')
  if (!auth.success) return auth.response
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim()
  const prisma = await getPrismaClient()
  const documents = await prisma.runbookDocument.findMany({
    where: {
      status: 'active',
      ...(query ? {
        OR: [
          { title: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
          { content: { contains: query, mode: 'insensitive' as const } },
          { tags: { has: query } }
        ]
      } : {})
    },
    select: {
      id: true, title: true, description: true, sourceType: true, sourceName: true,
      mimeType: true, contentHash: true, tags: true, status: true, createdByName: true,
      createdAt: true, updatedAt: true, _count: { select: { chunks: true } }
    },
    orderBy: { updatedAt: 'desc' },
    take: 200
  })
  return NextResponse.json({ success: true, data: documents })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'improve:write')
  if (!auth.success) return auth.response
  try {
    const data = documentSchema.parse(await request.json())
    const prisma = await getPrismaClient()
    const contentHash = hashRunbookContent(data.content)
    const existing = await prisma.runbookDocument.findFirst({ where: { contentHash, status: 'active' }, select: { id: true, title: true } })
    if (existing) return NextResponse.json({ success: false, error: `相同内容已存在：${existing.title}`, data: existing }, { status: 409 })
    const chunks = chunkRunbook(data.content)
    const document = await prisma.runbookDocument.create({
      data: {
        ...data,
        tags: normalizeTags(data.tags),
        contentHash,
        createdById: auth.user.id,
        createdByName: auth.user.username || auth.user.email,
        chunks: { create: chunks.map((content, chunkIndex) => ({ content, chunkIndex, tokenCount: estimateTokens(content) })) }
      },
      include: { _count: { select: { chunks: true } } }
    })
    await prisma.systemLog.create({ data: { level: 'info', category: 'knowledge', message: `创建知识文档：${document.title}`, source: 'knowledge-api', userId: auth.user.id, details: { documentId: document.id, chunkCount: chunks.length, contentHash } } })
    return NextResponse.json({ success: true, data: { ...document, content: undefined } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '创建知识文档失败' }, { status: 400 })
  }
}
