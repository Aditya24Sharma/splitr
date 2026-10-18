import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { computeBreakdown } from '@/lib/expense-breakdown'

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

  return NextResponse.json({ ...expense, breakdown })
}

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id]  — currently supports { loggedToSplitwise: boolean }
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

  if (typeof loggedToSplitwise !== 'boolean') {
    return NextResponse.json({ error: 'loggedToSplitwise must be a boolean' }, { status: 400 })
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: { loggedToSplitwise },
      include: {
        items: { include: { assignments: true }, orderBy: { sortOrder: 'asc' } },
        participants: true,
        payer: true,
      },
    })
    return NextResponse.json(expense)
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
