import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// GET /api/tags  — names of tags used by at least one expense
// ---------------------------------------------------------------------------
export async function GET() {
  const tags = await prisma.tag.findMany({
    where: { expenses: { some: {} } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(tags.map(t => t.name))
}
