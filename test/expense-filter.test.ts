import { describe, it, expect } from 'vitest'
import { filterExpenses } from '@/lib/expense-filter'

const walmart = { id: 'w', store: 'Walmart', description: '', tags: ['walmart'], itemNames: ['Whole Milk', 'Bread'] }
const tripWalmart = { id: 'tw', store: 'Walmart', description: '', tags: ['walmart', 'trip to x'], itemNames: ['Sunscreen'] }
const dinner = { id: 'd', store: null, description: 'Dinner at Luigi', tags: [], itemNames: [] }
const all = [walmart, tripWalmart, dinner]
const ids = (r: { expense: { id: string } }[]) => r.map(m => m.expense.id)

describe('filterExpenses', () => {
  it('returns everything when no tags or search are given', () => {
    expect(ids(filterExpenses(all, [], ''))).toEqual(['w', 'tw', 'd'])
  })

  it('keeps expenses with ANY selected tag', () => {
    expect(ids(filterExpenses(all, ['trip to x'], ''))).toEqual(['tw'])
    expect(ids(filterExpenses(all, ['walmart', 'trip to x'], ''))).toEqual(['w', 'tw'])
  })

  it('searches item names case-insensitively and reports matches', () => {
    const r = filterExpenses(all, [], '  MILK ')
    expect(ids(r)).toEqual(['w'])
    expect(r[0].matchedItems).toEqual(['Whole Milk'])
  })

  it('matches a simple expense by its description', () => {
    const r = filterExpenses(all, [], 'luigi')
    expect(ids(r)).toEqual(['d'])
    expect(r[0].matchedItems).toEqual([])
  })

  it('matches an itemized expense by its store', () => {
    expect(ids(filterExpenses(all, [], 'walmart'))).toEqual(['w', 'tw'])
  })

  it('combines tag filter and search', () => {
    expect(ids(filterExpenses(all, ['trip to x'], 'milk'))).toEqual([])
  })
})
