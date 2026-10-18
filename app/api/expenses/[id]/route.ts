import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { computeBreakdown } from '@/lib/expense-breakdown'
import { parseTags, connectTags } from '@/lib/tags'

// ---------------------------------------------------------------------------
// GET /api/expenses/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true }, orderBy: { sortOrder: 'asc' } },
      participants: true,
      payer: true,
      tags: { orderBy: { name: 'asc' } },
    },
  })

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  const breakdown = computeBreakdown({
    type: expense.type,
    splitMethod: expense.splitMethod,
    payerId: expense.payerId,
    taxCents: expense.taxCents,
    totalCents: expense.totalCents,
    items: expense.items.map(i => ({
      id: i.id,
      lineTotalCents: i.lineTotalCents,
      assignments: i.assignments.map(a => ({ personId: a.personId })),
    })),
    participants: expense.participants.map(p => ({
      personId: p.personId,
      exactAmountCents: p.exactAmountCents,
    })),
  })

  return NextResponse.json({ ...expense, tags: expense.tags.map(t => t.name), breakdown })
}

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id]  — supports { loggedToSplitwise?: boolean, tags?: string[] }
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { loggedToSplitwise } = body ?? {}

  if (loggedToSplitwise !== undefined && typeof loggedToSplitwise !== 'boolean') {
    return NextResponse.json({ error: 'loggedToSplitwise must be a boolean' }, { status: 400 })
  }
  const tags = body?.tags === undefined ? undefined : parseTags(body.tags)
  if (tags === null) {
    return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
  }
  if (loggedToSplitwise === undefined && tags === undefined) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(loggedToSplitwise !== undefined && { loggedToSplitwise }),
        // set: [] unlinks the old tags, then the new list is linked (created if missing)
        ...(tags !== undefined && { tags: { set: [], connectOrCreate: connectTags(tags) } }),
      },
      include: {
        items: { include: { assignments: true }, orderBy: { sortOrder: 'asc' } },
        participants: true,
        payer: true,
        tags: { orderBy: { name: 'asc' } },
      },
    })
    return NextResponse.json({ ...expense, tags: expense.tags.map(t => t.name) })
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    throw e
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/expenses/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }
    throw e
  }
}
