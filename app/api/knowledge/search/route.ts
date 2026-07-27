import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'improve:read')
  if (!auth.success) return auth.response
  const query = (new URL(request.url).searchParams.get('q') || '').trim()
  if (query.length < 2) return NextResponse.json({ success: false, error: '检索词至少 2 个字符' }, { status: 400 })
  const prisma = await getPrismaClient()
  const chunks = await prisma.runbookChunk.findMany({
    where: {
      document: { status: 'active' },
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
        { document: { title: { contains: query, mode: 'insensitive' } } },
        { document: { tags: { has: query } } }
      ]
    },
    include: { document: { select: { id: true, title: true, tags: true, updatedAt: true } } },
    orderBy: [{ document: { updatedAt: 'desc' } }, { chunkIndex: 'asc' }],
    take: 20
  })
  return NextResponse.json({ success: true, mode: 'keyword', data: chunks.map(item => ({
    id: item.id, documentId: item.documentId, documentTitle: item.document.title,
    chunkIndex: item.chunkIndex, content: item.content, tags: item.document.tags,
    citation: `[知识库：${item.document.title}#${item.chunkIndex + 1}]`
  })) })
}
