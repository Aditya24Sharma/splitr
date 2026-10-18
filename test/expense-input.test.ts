import { describe, it, expect } from 'vitest'
import { parseExpenseInput, expenseFields } from '@/lib/expense-input'

const itemized = {
  type: 'ITEMIZED',
  payerId: 'A',
  store: 'Walmart',
  taxCents: 70,
  tags: ['Walmart'],
  items: [
    { name: 'Milk', unitPriceCents: 400, lineTotalCents: 400, assigneeIds: ['A', 'B'] },
    { name: 'Bread', unitPriceCents: 300, lineTotalCents: 300, assigneeIds: ['B'] },
  ],
}

const simple = {
  type: 'SIMPLE',
  description: 'Dinner',
  payerId: 'A',
  totalCents: 6000,
  splitMethod: 'EVEN',
  participants: [{ personId: 'A' }, { personId: 'B' }],
}

describe('parseExpenseInput', () => {
  it('accepts an itemized expense and totals items + tax', () => {
    const r = parseExpenseInput(itemized)
    if ('error' in r) throw new Error(r.error)
    expect(r.input.type).toBe('ITEMIZED')
    expect(r.input.totalCents).toBe(770)
    expect(r.input.tags).toEqual(['walmart'])
    expect(expenseFields(r.input)).toMatchObject({ subtotalCents: 700, taxCents: 70, store: 'Walmart', purchasedAt: null })
  })

  it('clears a missing store to null so an edit can remove it', () => {
    const r = parseExpenseInput({ ...itemized, store: undefined })
    if ('error' in r) throw new Error(r.error)
    expect(expenseFields(r.input)).toMatchObject({ store: null })
  })

  it('rejects an item nobody shares', () => {
    const body = { ...itemized, items: [{ ...itemized.items[0], assigneeIds: [] }] }
    expect(parseExpenseInput(body)).toEqual({ error: expect.stringContaining('no assignees') })
  })

  it('accepts a simple even split with no tags', () => {
    const r = parseExpenseInput(simple)
    if ('error' in r) throw new Error(r.error)
    expect(r.input).toMatchObject({ type: 'SIMPLE', totalCents: 6000, tags: [] })
  })

  it('rejects an exact split that does not add up', () => {
    const body = {
      ...simple,
      splitMethod: 'EXACT',
      participants: [{ personId: 'A', exactAmountCents: 1000 }, { personId: 'B', exactAmountCents: 1000 }],
    }
    expect(parseExpenseInput(body)).toEqual({ error: 'exact split must sum to total' })
  })

  it('saves a date on a simple expense, and rejects a bad one', () => {
    const r = parseExpenseInput({ ...simple, purchasedAt: '2026-10-15' })
    if ('error' in r) throw new Error(r.error)
    expect(expenseFields(r.input)).toMatchObject({ purchasedAt: new Date('2026-10-15') })
    expect(parseExpenseInput({ ...simple, purchasedAt: 'next tuesday' })).toEqual({
      error: 'purchasedAt must be a date like 2026-10-18',
    })
  })

  it('rejects missing fields and unknown types', () => {
    expect(parseExpenseInput({ ...simple, description: '' })).toEqual({ error: 'description is required' })
    expect(parseExpenseInput({ ...itemized, payerId: undefined })).toEqual({ error: 'payerId is required' })
    expect(parseExpenseInput({ type: 'OTHER' })).toEqual({ error: 'type must be ITEMIZED or SIMPLE' })
    expect(parseExpenseInput(null)).toEqual({ error: 'type must be ITEMIZED or SIMPLE' })
  })
})
