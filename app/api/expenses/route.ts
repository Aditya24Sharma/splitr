import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeBreakdown } from '@/lib/expense-breakdown'
import { connectTags, unknownTags } from '@/lib/tags'
import { parseExpenseInput, expenseFields, createExpenseChildren } from '@/lib/expense-input'

// ---------------------------------------------------------------------------
// POST /api/expenses
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
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

  const expense = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.create({
      data: { ...expenseFields(input), tags: { connect: connectTags(input.tags) } },
    })
    await createExpenseChildren(tx, exp.id, input)
    return tx.expense.findUniqueOrThrow({
      where: { id: exp.id },
      include: { items: { include: { assignments: true } }, participants: true },
    })
  })

  return NextResponse.json({ id: expense.id, breakdown: computeBreakdown(expense) }, { status: 201 })
}

// ---------------------------------------------------------------------------
// GET /api/expenses
// ---------------------------------------------------------------------------
export async function GET() {
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
