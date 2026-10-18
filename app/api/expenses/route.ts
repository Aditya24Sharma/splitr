import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeBreakdown, BreakdownExpense } from '@/lib/expense-breakdown'

// ---------------------------------------------------------------------------
// POST /api/expenses
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type } = body ?? {}

  // ---- ITEMIZED ----
  if (type === 'ITEMIZED') {
    const { store, purchasedAt, payerId, taxCents, items } = body

    if (!payerId || typeof payerId !== 'string') {
      return NextResponse.json({ error: 'payerId is required' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 })
    }
    if (typeof taxCents !== 'number') {
      return NextResponse.json({ error: 'taxCents is required' }, { status: 400 })
    }

    const totalCents = items.reduce((s: number, i: any) => s + (i.lineTotalCents ?? 0), 0) + taxCents

    // Server-side validation via split engine
    const prospective: BreakdownExpense = {
      type: 'ITEMIZED',
      splitMethod: 'ITEMIZED',
      payerId,
      taxCents,
      totalCents,
      items: items.map((it: any, idx: number) => ({
        id: String(idx),
        lineTotalCents: it.lineTotalCents,
        assignments: (it.assigneeIds ?? []).map((pid: string) => ({ personId: pid })),
      })),
      participants: [],
    }
    try {
      computeBreakdown(prospective)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Invalid split' }, { status: 400 })
    }

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          type: 'ITEMIZED',
          splitMethod: 'ITEMIZED',
          payerId,
          subtotalCents: totalCents - taxCents,
          taxCents,
          totalCents,
          ...(store !== undefined && { store }),
          ...(purchasedAt !== undefined && { purchasedAt: new Date(purchasedAt) }),
        },
      })
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx]
        const item = await tx.item.create({
          data: {
            expenseId: exp.id,
            name: it.name,
            rawName: it.rawName,
            quantity: it.quantity ?? 1,
            unitPriceCents: it.unitPriceCents,
            lineTotalCents: it.lineTotalCents,
            sortOrder: idx,
          },
        })
        for (const pid of (it.assigneeIds ?? []) as string[]) {
          await tx.itemAssignment.create({ data: { itemId: item.id, personId: pid } })
        }
      }
      return tx.expense.findUniqueOrThrow({
        where: { id: exp.id },
        include: { items: { include: { assignments: true } }, participants: true },
      })
    })

    const breakdown = computeBreakdown({
      type: 'ITEMIZED',
      splitMethod: 'ITEMIZED',
      payerId: expense.payerId,
      taxCents: expense.taxCents,
      totalCents: expense.totalCents,
      items: expense.items.map(i => ({
        id: i.id,
        lineTotalCents: i.lineTotalCents,
        assignments: i.assignments.map(a => ({ personId: a.personId })),
      })),
      participants: [],
    })

    return NextResponse.json({ id: expense.id, breakdown }, { status: 201 })
  }

  // ---- SIMPLE ----
  if (type === 'SIMPLE') {
    const { description, payerId, totalCents, splitMethod, participants } = body

    if (!payerId || typeof payerId !== 'string') {
      return NextResponse.json({ error: 'payerId is required' }, { status: 400 })
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }
    if (typeof totalCents !== 'number') {
      return NextResponse.json({ error: 'totalCents is required' }, { status: 400 })
    }
    if (splitMethod !== 'EVEN' && splitMethod !== 'EXACT') {
      return NextResponse.json({ error: 'splitMethod must be EVEN or EXACT' }, { status: 400 })
    }
    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: 'participants must be a non-empty array' }, { status: 400 })
    }

    // Server-side validation via split engine
    const prospective: BreakdownExpense = {
      type: 'SIMPLE',
      splitMethod,
      payerId,
      taxCents: 0,
      totalCents,
      items: [],
      participants: participants.map((p: any) => ({
        personId: p.personId,
        exactAmountCents: p.exactAmountCents ?? null,
      })),
    }
    try {
      computeBreakdown(prospective)
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? 'Invalid split' }, { status: 400 })
    }

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          type: 'SIMPLE',
          splitMethod,
          description,
          payerId,
          subtotalCents: totalCents,
          taxCents: 0,
          totalCents,
        },
      })
      for (const p of participants as any[]) {
        await tx.expenseParticipant.create({
          data: {
            expenseId: exp.id,
            personId: p.personId,
            exactAmountCents: p.exactAmountCents ?? null,
          },
        })
      }
      return tx.expense.findUniqueOrThrow({
        where: { id: exp.id },
        include: { items: { include: { assignments: true } }, participants: true },
      })
    })

    const breakdown = computeBreakdown({
      type: 'SIMPLE',
      splitMethod,
      payerId: expense.payerId,
      taxCents: expense.taxCents,
      totalCents: expense.totalCents,
      items: [],
      participants: expense.participants.map(p => ({
        personId: p.personId,
        exactAmountCents: p.exactAmountCents,
      })),
    })

    return NextResponse.json({ id: expense.id, breakdown }, { status: 201 })
  }

  return NextResponse.json({ error: 'type must be ITEMIZED or SIMPLE' }, { status: 400 })
}

// ---------------------------------------------------------------------------
// GET /api/expenses
// ---------------------------------------------------------------------------
export async function GET() {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { assignments: true } },
      participants: true,
      payer: true,
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
      breakdown: { perPerson: breakdown.perPerson },
    }
  })

  return NextResponse.json(result)
}
