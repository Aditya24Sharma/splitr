import { Prisma } from '@prisma/client'
import { computeBreakdown, BreakdownExpense } from '@/lib/expense-breakdown'
import { parseTags } from '@/lib/tags'

// Shared by POST /api/expenses (create) and PUT /api/expenses/[id] (edit) so
// both validate and write an expense the same way.

interface ItemInput {
  name: string
  rawName?: string | null
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
  assigneeIds: string[]
}

export type ExpenseInput =
  | {
      type: 'ITEMIZED'
      payerId: string
      store: string | null
      purchasedAt: Date | null
      taxCents: number
      totalCents: number
      tags: string[]
      items: ItemInput[]
    }
  | {
      type: 'SIMPLE'
      payerId: string
      description: string
      purchasedAt: Date | null
      totalCents: number
      splitMethod: 'EVEN' | 'EXACT'
      tags: string[]
      participants: { personId: string; exactAmountCents: number | null }[]
    }

/** Validates a request body. Returns the cleaned input, or an error message for a 400. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw JSON body, checked field by field below
export function parseExpenseInput(body: any): { input: ExpenseInput } | { error: string } {
  const { type } = body ?? {}

  const tags = body?.tags === undefined ? [] : parseTags(body.tags)
  if (tags === null) return { error: 'tags must be an array of strings' }

  const purchasedAt = parseDate(body?.purchasedAt)
  if (purchasedAt === undefined) return { error: 'purchasedAt must be a date like 2026-10-18' }

  if (type === 'ITEMIZED') {
    const { store, payerId, taxCents, items } = body

    if (!payerId || typeof payerId !== 'string') return { error: 'payerId is required' }
    if (!Array.isArray(items) || items.length === 0) return { error: 'items must be a non-empty array' }
    if (typeof taxCents !== 'number') return { error: 'taxCents is required' }

    const cleanItems: ItemInput[] = items.map(it => ({
      name: it.name,
      rawName: it.rawName,
      quantity: it.quantity ?? 1,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      assigneeIds: it.assigneeIds ?? [],
    }))
    const totalCents = cleanItems.reduce((s, i) => s + (i.lineTotalCents ?? 0), 0) + taxCents

    const error = splitError({
      type: 'ITEMIZED',
      splitMethod: 'ITEMIZED',
      payerId,
      taxCents,
      totalCents,
      items: cleanItems.map((it, idx) => ({
        id: String(idx),
        lineTotalCents: it.lineTotalCents,
        assignments: it.assigneeIds.map(pid => ({ personId: pid })),
      })),
      participants: [],
    })
    if (error) return { error }

    return {
      input: {
        type: 'ITEMIZED',
        payerId,
        store: store ?? null,
        purchasedAt,
        taxCents,
        totalCents,
        tags,
        items: cleanItems,
      },
    }
  }

  if (type === 'SIMPLE') {
    const { description, payerId, totalCents, splitMethod, participants } = body

    if (!payerId || typeof payerId !== 'string') return { error: 'payerId is required' }
    if (!description || typeof description !== 'string') return { error: 'description is required' }
    if (typeof totalCents !== 'number') return { error: 'totalCents is required' }
    if (splitMethod !== 'EVEN' && splitMethod !== 'EXACT') return { error: 'splitMethod must be EVEN or EXACT' }
    if (!Array.isArray(participants) || participants.length === 0) {
      return { error: 'participants must be a non-empty array' }
    }

    const cleanParticipants = participants.map(p => ({
      personId: p.personId,
      exactAmountCents: p.exactAmountCents ?? null,
    }))
    const error = splitError({
      type: 'SIMPLE',
      splitMethod,
      payerId,
      taxCents: 0,
      totalCents,
      items: [],
      participants: cleanParticipants,
    })
    if (error) return { error }

    return {
      input: {
        type: 'SIMPLE',
        payerId,
        description,
        purchasedAt,
        totalCents,
        splitMethod,
        tags,
        participants: cleanParticipants,
      },
    }
  }

  return { error: 'type must be ITEMIZED or SIMPLE' }
}

/** Blank = no date (null); a valid date string = Date; anything else = undefined (invalid). */
function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

/** Runs the split engine on a prospective expense; returns its error message, if any. */
function splitError(e: BreakdownExpense): string | null {
  try {
    computeBreakdown(e)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid split'
  }
}

/** The expense row's own columns (not items, participants, or tags). */
export function expenseFields(input: ExpenseInput) {
  if (input.type === 'ITEMIZED') {
    return {
      type: 'ITEMIZED' as const,
      splitMethod: 'ITEMIZED' as const,
      payerId: input.payerId,
      subtotalCents: input.totalCents - input.taxCents,
      taxCents: input.taxCents,
      totalCents: input.totalCents,
      store: input.store,
      purchasedAt: input.purchasedAt,
    }
  }
  return {
    type: 'SIMPLE' as const,
    splitMethod: input.splitMethod,
    description: input.description,
    purchasedAt: input.purchasedAt,
    payerId: input.payerId,
    subtotalCents: input.totalCents,
    taxCents: 0,
    totalCents: input.totalCents,
  }
}

/** Creates the items + assignments (itemized) or participants (simple) for an expense. */
export async function createExpenseChildren(
  tx: Prisma.TransactionClient,
  expenseId: string,
  input: ExpenseInput,
) {
  if (input.type === 'ITEMIZED') {
    for (let idx = 0; idx < input.items.length; idx++) {
      const it = input.items[idx]
      const item = await tx.item.create({
        data: {
          expenseId,
          name: it.name,
          rawName: it.rawName,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          lineTotalCents: it.lineTotalCents,
          sortOrder: idx,
        },
      })
      for (const pid of it.assigneeIds) {
        await tx.itemAssignment.create({ data: { itemId: item.id, personId: pid } })
      }
    }
  } else {
    for (const p of input.participants) {
      await tx.expenseParticipant.create({
        data: { expenseId, personId: p.personId, exactAmountCents: p.exactAmountCents },
      })
    }
  }
}

