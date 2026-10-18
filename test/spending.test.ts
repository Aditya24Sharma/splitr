import { describe, it, expect } from 'vitest'
import {
  categoryLabel,
  isSpending,
  netBalance,
  shiftMonth,
  summarizeMonth,
  yourShare,
  type SpendingTx,
} from '@/lib/spending'

const tx = (over: Partial<SpendingTx>): SpendingTx => ({
  date: '2026-10-05',
  amount: 1000,
  categoryPrimary: 'FOOD_AND_DRINK',
  categoryDetailed: null,
  owedBackCents: 0,
  ...over,
})

describe('isSpending', () => {
  it('counts money out, not money in', () => {
    expect(isSpending(tx({}))).toBe(true)
    expect(isSpending(tx({ amount: -500 }))).toBe(false)
  })
  it('skips transfers and credit card bill payments', () => {
    expect(isSpending(tx({ categoryPrimary: 'TRANSFER_OUT' }))).toBe(false)
    expect(
      isSpending(tx({ categoryPrimary: 'LOAN_PAYMENTS', categoryDetailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' })),
    ).toBe(false)
    expect(isSpending(tx({ categoryPrimary: 'LOAN_PAYMENTS', categoryDetailed: 'LOAN_PAYMENTS_CAR_PAYMENT' }))).toBe(true)
  })
})

describe('yourShare', () => {
  it('takes off what friends owe back, never below zero', () => {
    expect(yourShare(tx({ amount: 6000, owedBackCents: 4000 }))).toBe(2000)
    expect(yourShare(tx({ amount: 6000, owedBackCents: 7000 }))).toBe(0)
  })
})

describe('summarizeMonth', () => {
  it('totals one month and ranks categories by your share', () => {
    const s = summarizeMonth(
      [
        tx({ amount: 6000, owedBackCents: 4000 }), // dinner split 3 ways
        tx({ amount: 3000, categoryPrimary: 'GENERAL_MERCHANDISE' }),
        tx({ amount: -200000, categoryPrimary: 'INCOME' }),
        tx({ amount: -50000, categoryPrimary: 'TRANSFER_IN' }),
        tx({ amount: 90000, categoryPrimary: 'TRANSFER_OUT' }),
        tx({ date: '2026-09-30', amount: 9999 }),
      ],
      '2026-10',
    )
    expect(s.spentCents).toBe(9000)
    expect(s.owedBackCents).toBe(4000)
    expect(s.yourShareCents).toBe(5000)
    expect(s.incomeCents).toBe(200000)
    expect(s.byCategory).toEqual([
      { category: 'GENERAL_MERCHANDISE', cents: 3000 },
      { category: 'FOOD_AND_DRINK', cents: 2000 },
    ])
  })
})

describe('netBalance', () => {
  it('subtracts credit and loan balances', () => {
    expect(
      netBalance([
        { type: 'depository', currentBalance: 100000 },
        { type: 'credit', currentBalance: 25000 },
        { type: 'investment', currentBalance: null },
      ]),
    ).toBe(75000)
  })
})

describe('helpers', () => {
  it('labels categories', () => {
    expect(categoryLabel('FOOD_AND_DRINK')).toBe('Food & drink')
    expect(categoryLabel('SOMETHING_NEW')).toBe('Something new')
    expect(categoryLabel(null)).toBe('Uncategorized')
  })
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})
