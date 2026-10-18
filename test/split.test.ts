import { describe, it, expect } from 'vitest'
import { splitItemized, splitSimpleEven, splitSimpleExact } from '@/lib/split'
import { WALMART, SAMS } from './fixtures/receipts'

const sum = (xs: { cents: number }[]) => xs.reduce((a, b) => a + b.cents, 0)
const itemsFor = (fx: typeof WALMART, assign: (id: string) => string[]) =>
  fx.items.map(([id, c]) => ({ id, lineTotalCents: c, assigneeIds: assign(id) }))

describe('splitItemized — invariants', () => {
  it('everything shared by two people sums exactly to total (Sam\'s)', () => {
    const r = splitItemized({ items: itemsFor(SAMS, () => ['A', 'B']), taxCents: SAMS.taxCents })
    expect(sum(r.perPerson)).toBe(SAMS.totalCents)
    expect(r.perItem.reduce((a, b) => a + b.effectiveCents, 0)).toBe(SAMS.totalCents)
    // global LCM reconciliation: 8079 is odd, the single leftover cent goes to A (sorted first)
    const byId = Object.fromEntries(r.perPerson.map(p => [p.personId, p.cents]))
    expect([byId.A, byId.B].sort((a,b)=>b-a)).toEqual([4040, 4039])
  })
  it('mixed assignment still re-sums to total (Walmart)', () => {
    // chicken-like split: a couple of items to one person, rest shared
    const r = splitItemized({
      items: itemsFor(WALMART, id => id === 'apple' ? ['A'] : id === 'mango' ? ['B'] : ['A','B']),
      taxCents: WALMART.taxCents,
    })
    expect(sum(r.perPerson)).toBe(WALMART.totalCents)
    expect(r.perPerson.every(p => p.cents >= 0)).toBe(true)
  })
  it('3-way heterogeneous assignment reconciles (D=6 path)', () => {
    const r = splitItemized({
      items: [
        { id: 'x', lineTotalCents: 100, assigneeIds: ['A','B'] },
        { id: 'y', lineTotalCents: 100, assigneeIds: ['A','B','C'] },
      ],
      taxCents: 0,
    })
    expect(sum(r.perPerson)).toBe(200)
    expect(r.perPerson).toEqual([
      { personId: 'A', cents: 84 },
      { personId: 'B', cents: 83 },
      { personId: 'C', cents: 33 },
    ])
  })
  it('single assignee on every item -> that person owes the whole total', () => {
    const r = splitItemized({ items: itemsFor(SAMS, () => ['solo']), taxCents: SAMS.taxCents })
    expect(r.perPerson).toEqual([{ personId: 'solo', cents: SAMS.totalCents }])
  })
  it('is deterministic', () => {
    const mk = () => splitItemized({ items: itemsFor(WALMART, () => ['A','B','C']), taxCents: WALMART.taxCents })
    expect(mk()).toEqual(mk())
  })
  it('zero tax reconciles', () => {
    const r = splitItemized({ items: itemsFor(WALMART, () => ['A','B']), taxCents: 0 })
    expect(sum(r.perPerson)).toBe(WALMART.subtotalCents)
  })
  it('throws when an item has no assignees', () => {
    expect(() => splitItemized({ items: [{ id: 'x', lineTotalCents: 100, assigneeIds: [] }], taxCents: 0 }))
      .toThrow()
  })
  it('exact even halves when total is even (Walmart $58.02 shared by two)', () => {
    const r = splitItemized({ items: itemsFor(WALMART, () => ['A', 'B']), taxCents: WALMART.taxCents })
    expect(r.perPerson).toEqual([{ personId: 'A', cents: 2901 }, { personId: 'B', cents: 2901 }])
    expect(r.perItem.reduce((a, b) => a + b.effectiveCents, 0)).toBe(WALMART.totalCents)
  })
})

describe('splitSimple', () => {
  it('even split reconciles to total', () => {
    const r = splitSimpleEven(10000, ['A','B','C'])
    expect(sum(r)).toBe(10000)
    expect(r.map(p=>p.cents).sort((a,b)=>b-a)).toEqual([3334, 3333, 3333])
  })
  it('exact split passes when sums match, throws otherwise', () => {
    expect(splitSimpleExact(5000, [{personId:'A',cents:2000},{personId:'B',cents:3000}]))
      .toEqual([{personId:'A',cents:2000},{personId:'B',cents:3000}])
    expect(() => splitSimpleExact(5000, [{personId:'A',cents:2000},{personId:'B',cents:2000}]))
      .toThrow()
  })
})
