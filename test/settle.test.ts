import { describe, it, expect } from 'vitest'
import { settleExpenses } from '@/lib/settle'

describe('settleExpenses', () => {
  it('returns nothing for no expenses', () => {
    expect(settleExpenses([])).toEqual([])
  })

  it('excludes the payer own share', () => {
    const debts = settleExpenses([
      { payerId: 'A', perPerson: [{ personId: 'A', cents: 500 }, { personId: 'B', cents: 300 }] },
    ])
    expect(debts).toEqual([{ fromId: 'B', toId: 'A', cents: 300 }])
  })

  it('adds up debts to the same payer across expenses', () => {
    const debts = settleExpenses([
      { payerId: 'A', perPerson: [{ personId: 'B', cents: 300 }] },
      { payerId: 'A', perPerson: [{ personId: 'B', cents: 200 }, { personId: 'C', cents: 100 }] },
    ])
    expect(debts).toEqual([
      { fromId: 'B', toId: 'A', cents: 500 },
      { fromId: 'C', toId: 'A', cents: 100 },
    ])
  })

  it('nets opposite directions within a pair', () => {
    const debts = settleExpenses([
      { payerId: 'B', perPerson: [{ personId: 'A', cents: 3000 }] },
      { payerId: 'A', perPerson: [{ personId: 'B', cents: 1000 }] },
    ])
    expect(debts).toEqual([{ fromId: 'A', toId: 'B', cents: 2000 }])
  })

  it('drops pairs that cancel out exactly', () => {
    const debts = settleExpenses([
      { payerId: 'A', perPerson: [{ personId: 'B', cents: 750 }] },
      { payerId: 'B', perPerson: [{ personId: 'A', cents: 750 }] },
    ])
    expect(debts).toEqual([])
  })
})
