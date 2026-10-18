import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { normalizeTag } from '@/lib/tags'

// ---------------------------------------------------------------------------
// GET /api/tags  — every tag, with how many expenses use it
// ---------------------------------------------------------------------------
export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { expenses: true } } },
  })
  return NextResponse.json(tags.map(t => ({ id: t.id, name: t.name, expenseCount: t._count.expenses })))
}

// ---------------------------------------------------------------------------
// POST /api/tags  — { name }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const raw = (body as { name?: unknown } | null)?.name
  const name = typeof raw === 'string' ? normalizeTag(raw) : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const tag = await prisma.tag.create({ data: { name } })
    return NextResponse.json({ id: tag.id, name: tag.name, expenseCount: 0 }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: `Tag "${name}" already exists` }, { status: 409 })
    }
    throw e
  }
}
