import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getD1, getDb } from '@/lib/db'
import { computeBreakdown } from '@/lib/expense-breakdown'
import { parseTags, connectTags, tagIds, unknownTags } from '@/lib/tags'
import { parseExpenseInput } from '@/lib/expense-input'
import { replaceExpense } from '@/lib/expense-write'

// ---------------------------------------------------------------------------
// GET /api/expenses/[id]
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const prisma = getDb()
  const { id } = await params

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      items: { include: { assignments: true }, orderBy: { sortOrder: 'asc' } },
      participants: true,
      payer: true,
      tags: { orderBy: { name: 'asc' } },
      // select, not include: the bank row holds the Plaid access token
      transaction: {
        select: {
          id: true,
          date: true,
          amount: true,
          source: true,
          account: { select: { name: true, mask: true, item: { select: { institutionName: true } } } },
        },
      },
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
  const prisma = getDb()
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
  const missing = tags ? await unknownTags(prisma, tags) : []
  if (missing.length > 0) {
    return NextResponse.json({ error: `unknown tag: ${missing.join(', ')}` }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(loggedToSplitwise !== undefined && { loggedToSplitwise }),
        // set replaces the expense's tags with exactly this list
        ...(tags !== undefined && { tags: { set: connectTags(tags) } }),
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
// PUT /api/expenses/[id]  — replace an expense with an edited version.
// Same body as POST /api/expenses; the type can't change. Clears
// loggedToSplitwise so the edit gets re-entered in Splitwise.
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const prisma = getDb()
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseExpenseInput(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { input } = parsed
  const missing = await unknownTags(prisma, input.tags)
  if (missing.length > 0) {
    return NextResponse.json({ error: `unknown tag: ${missing.join(', ')}` }, { status: 400 })
  }

  const existing = await prisma.expense.findUnique({ where: { id }, select: { type: true } })
  if (!existing) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }
  if (existing.type !== input.type) {
    return NextResponse.json({ error: 'expense type cannot be changed' }, { status: 400 })
  }

  await replaceExpense(getD1(), id, input, await tagIds(prisma, input.tags))
  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { assignments: true } }, participants: true },
  })

  return NextResponse.json({ id: expense.id, breakdown: computeBreakdown(expense) })
}

// ---------------------------------------------------------------------------
// DELETE /api/expenses/[id]
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const prisma = getDb()
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
