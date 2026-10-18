import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { normalizeTag } from '@/lib/tags'

// ---------------------------------------------------------------------------
// PATCH /api/tags/[id]  — rename: { name }. Expenses link to the tag, so
// every expense using it shows the new name.
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
    const tag = await prisma.tag.update({
      where: { id },
      data: { name },
      include: { _count: { select: { expenses: true } } },
    })
    return NextResponse.json({ id: tag.id, name: tag.name, expenseCount: tag._count.expenses })
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: `Tag "${name}" already exists` }, { status: 409 })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }
    throw e
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tags/[id]  — the tag is removed from any expenses using it;
// the expenses themselves are kept.
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    await prisma.tag.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }
    throw e
  }
}
