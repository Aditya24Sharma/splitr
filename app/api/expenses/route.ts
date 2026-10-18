import { NextRequest, NextResponse } from 'next/server'
import { getD1, getDb } from '@/lib/db'
import { computeBreakdown } from '@/lib/expense-breakdown'
import { tagIds, unknownTags } from '@/lib/tags'
import { parseExpenseInput } from '@/lib/expense-input'
import { createExpense } from '@/lib/expense-write'

// ---------------------------------------------------------------------------
// POST /api/expenses
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const prisma = getDb()
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

  // Optional: the bank or hand-added transaction this split was made from
  const { transactionId } = (body ?? {}) as { transactionId?: unknown }
  if (transactionId !== undefined) {
    if (!Number.isInteger(transactionId)) {
      return NextResponse.json({ error: 'transactionId must be an integer' }, { status: 400 })
    }
    const source = await prisma.transaction.findUnique({
      where: { id: transactionId as number },
      select: { expense: { select: { id: true } } },
    })
    if (!source) return NextResponse.json({ error: 'That transaction no longer exists' }, { status: 400 })
    if (source.expense) {
      return NextResponse.json({ error: 'That transaction is already split' }, { status: 409 })
    }
  }

  const id = await createExpense(
    getD1(),
    input,
    await tagIds(prisma, input.tags),
    transactionId as number | undefined,
  )
  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { assignments: true } }, participants: true },
  })

  return NextResponse.json({ id: expense.id, breakdown: computeBreakdown(expense) }, { status: 201 })
}

// ---------------------------------------------------------------------------
// GET /api/expenses
// ---------------------------------------------------------------------------
export async function GET() {
  const prisma = getDb()
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { assignments: true }, orderBy: { sortOrder: 'asc' } },
      participants: true,
      payer: true,
      tags: { orderBy: { name: 'asc' } },
    },
  })

  const result = expenses.map(exp => {
    const breakdown = computeBreakdown({
      type: exp.type,
      splitMethod: exp.splitMethod,
      payerId: exp.payerId,
      taxCents: exp.taxCents,
      totalCents: exp.totalCents,
      items: exp.items.map(i => ({
        id: i.id,
        lineTotalCents: i.lineTotalCents,
        assignments: i.assignments.map(a => ({ personId: a.personId })),
      })),
      participants: exp.participants.map(p => ({
        personId: p.personId,
        exactAmountCents: p.exactAmountCents,
      })),
    })
    return {
      id: exp.id,
      type: exp.type,
      description: exp.description,
      store: exp.store,
      purchasedAt: exp.purchasedAt,
      payerId: exp.payerId,
      payer: exp.payer,
      totalCents: exp.totalCents,
      splitMethod: exp.splitMethod,
      loggedToSplitwise: exp.loggedToSplitwise,
      createdAt: exp.createdAt,
      tags: exp.tags.map(t => t.name),
      itemNames: exp.items.map(i => i.name),
      breakdown: { perPerson: breakdown.perPerson },
    }
  })

  return NextResponse.json(result)
}
