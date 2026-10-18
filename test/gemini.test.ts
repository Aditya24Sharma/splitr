import { describe, it, expect } from 'vitest'
import { validateParsedReceipt } from '@/lib/gemini'

const base = {
  store: 'Walmart', purchasedAt: '2026-06-24',
  items: [{ rawName: 'EGGS', name: 'Eggs', quantity: 1, unitPrice: 55.26, lineTotal: 55.26 }],
  subtotal: 55.26, tax: 2.76, total: 58.02, warnings: [],
}
describe('validateParsedReceipt', () => {
  it('no warnings when totals reconcile', () => {
    expect(validateParsedReceipt(base)).toEqual([])
  })
  it('warns on item/subtotal mismatch', () => {
    expect(validateParsedReceipt({ ...base, items: [{ ...base.items[0], lineTotal: 50 }] }).length).toBeGreaterThan(0)
  })
  it('warns on subtotal+tax/total mismatch', () => {
    expect(validateParsedReceipt({ ...base, total: 99 }).length).toBeGreaterThan(0)
  })
})
