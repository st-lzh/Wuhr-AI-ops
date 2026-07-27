import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth/apiHelpers'
import { getPrismaClient } from '../../../../lib/config/database'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'servers:read')
  if (!auth.success) return auth.response
  const prisma = await getPrismaClient()
  const runs = await prisma.automationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json({ success: true, data: runs })
}
