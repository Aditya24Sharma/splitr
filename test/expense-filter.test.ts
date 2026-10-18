import { describe, it, expect } from 'vitest'
import { filterExpenses, expenseDay, NO_FILTERS, ExpenseFilters } from '@/lib/expense-filter'

const base = {
  store: null,
  description: '',
  payerId: 'A',
  loggedToSplitwise: false,
  purchasedAt: null,
  createdAt: '2026-10-18T15:00:00.000Z',
  tags: [] as string[],
  itemNames: [] as string[],
  breakdown: { perPerson: [{ personId: 'A' }, { personId: 'B' }] },
}
const walmart = { ...base, id: 'w', store: 'Walmart', purchasedAt: '2026-10-10T00:00:00.000Z', tags: ['walmart'], itemNames: ['Whole Milk', 'Bread'] }
const tripWalmart = { ...base, id: 'tw', store: 'Walmart', purchasedAt: '2026-10-14T00:00:00.000Z', tags: ['walmart', 'trip to x'], itemNames: ['Sunscreen'], loggedToSplitwise: true }
const dinner = {
  ...base,
  id: 'd',
  description: 'Dinner at Luigi',
  purchasedAt: '2026-10-12T00:00:00.000Z',
  payerId: 'C',
  breakdown: { perPerson: [{ personId: 'B' }, { personId: 'C' }] },
}
const all = [walmart, tripWalmart, dinner]
const ids = (r: { expense: { id: string } }[]) => r.map(m => m.expense.id)
const run = (f: Partial<ExpenseFilters>) => filterExpenses(all, { ...NO_FILTERS, ...f })

describe('expenseDay', () => {
  it('uses the saved date as-is, whatever the time zone', () => {
    expect(expenseDay({ purchasedAt: '2026-10-10T00:00:00.000Z', createdAt: '2026-10-18T15:00:00.000Z' })).toBe('2026-10-10')
  })

  it('falls back to the local day the expense was entered', () => {
    const created = new Date(2026, 9, 18, 23, 30) // 11:30pm local, Oct 18
    expect(expenseDay({ purchasedAt: null, createdAt: created.toISOString() })).toBe('2026-10-18')
  })
})

describe('filterExpenses', () => {
  it('returns everything, newest day first, when no filters are set', () => {
    expect(ids(run({}))).toEqual(['tw', 'd', 'w'])
  })

  it('keeps expenses with ANY selected tag', () => {
    expect(ids(run({ tags: ['trip to x'] }))).toEqual(['tw'])
    expect(ids(run({ tags: ['walmart', 'trip to x'] }))).toEqual(['tw', 'w'])
  })

  it('searches item names case-insensitively and reports matches', () => {
    const r = run({ query: '  MILK ' })
    expect(ids(r)).toEqual(['w'])
    expect(r[0].matchedItems).toEqual(['Whole Milk'])
  })

  it('matches a simple expense by its description', () => {
    const r = run({ query: 'luigi' })
    expect(ids(r)).toEqual(['d'])
    expect(r[0].matchedItems).toEqual([])
  })

  it('matches an itemized expense by its store', () => {
    expect(ids(run({ query: 'walmart' }))).toEqual(['tw', 'w'])
  })

  it('filters by an inclusive date range, either end optional', () => {
    expect(ids(run({ from: '2026-10-12', to: '2026-10-14' }))).toEqual(['tw', 'd'])
    expect(ids(run({ from: '2026-10-13' }))).toEqual(['tw'])
    expect(ids(run({ to: '2026-10-10' }))).toEqual(['w'])
  })

  it('filters by a person who paid or has a share', () => {
    expect(ids(run({ personIds: ['A'] }))).toEqual(['tw', 'w'])
    expect(ids(run({ personIds: ['C'] }))).toEqual(['d'])
    expect(ids(run({ personIds: ['B'] }))).toEqual(['tw', 'd', 'w'])
  })

  it('with several people, keeps only expenses ALL of them are in', () => {
    expect(ids(run({ personIds: ['B', 'C'] }))).toEqual(['d'])
    expect(ids(run({ personIds: ['A', 'C'] }))).toEqual([])
  })

  it('filters by who paid, matching ANY of the payers picked', () => {
    expect(ids(run({ payerIds: ['C'] }))).toEqual(['d'])
    expect(ids(run({ payerIds: ['A', 'C'] }))).toEqual(['tw', 'd', 'w'])
  })

  it('filters by Splitwise status', () => {
    expect(ids(run({ logged: 'logged' }))).toEqual(['tw'])
    expect(ids(run({ logged: 'not-logged' }))).toEqual(['d', 'w'])
  })

  it('combines filters', () => {
    expect(ids(run({ tags: ['trip to x'], query: 'milk' }))).toEqual([])
    expect(ids(run({ personIds: ['A'], logged: 'not-logged' }))).toEqual(['w'])
  })
})
