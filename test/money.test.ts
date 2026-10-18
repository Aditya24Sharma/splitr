import { describe, it, expect } from 'vitest'
import { toCents, toDollars, formatUSD, apportion } from '@/lib/money'

describe('toCents/toDollars/formatUSD', () => {
  it('converts dollars to integer cents (half-up)', () => {
    expect(toCents(58.02)).toBe(5802)
    expect(toCents(0.1 + 0.2)).toBe(30)   // float-safe
    expect(toCents(1.005)).toBe(101)      // half-up
  })
  it('round-trips and formats', () => {
    expect(toDollars(5802)).toBeCloseTo(58.02, 5)
    expect(formatUSD(5802)).toBe('$58.02')
    expect(formatUSD(8)).toBe('$0.08')
    expect(formatUSD(0)).toBe('$0.00')
    expect(formatUSD(-150)).toBe('-$1.50')
    expect(formatUSD(124050)).toBe('$1,240.50')
    expect(formatUSD(100000)).toBe('$1,000.00')
    expect(formatUSD(99999)).toBe('$999.99')
    expect(formatUSD(123456789)).toBe('$1,234,567.89')
    expect(formatUSD(-124050)).toBe('-$1,240.50')
  })
})

describe('apportion (largest-remainder)', () => {
  it('splits evenly when weights are equal, parts sum to total', () => {
    expect(apportion(8079, [1, 1])).toEqual([4040, 4039]) // leftover cent to lower index
    expect(apportion(100, [1, 1, 1])).toEqual([34, 33, 33])
  })
  it('splits proportionally to weights and sums exactly', () => {
    const parts = apportion(276, [5526]) // single weight -> all of it
    expect(parts).toEqual([276])
    const two = apportion(300, [100, 200])
    expect(two.reduce((a, b) => a + b, 0)).toBe(300)
    expect(two).toEqual([100, 200])
  })
  it('handles all-zero weights as even split', () => {
    expect(apportion(10, [0, 0, 0])).toEqual([4, 3, 3])
  })
  it('always sums exactly to total for messy inputs', () => {
    const parts = apportion(2776, [548, 212, 713, 328, 152, 78, 194])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(2776)
    expect(parts.every(p => Number.isInteger(p) && p >= 0)).toBe(true)
  })
  it('throws on empty weights', () => {
    expect(() => apportion(100, [])).toThrow()
  })
  it('throws on negative total', () => {
    expect(() => apportion(-1, [1, 2])).toThrow()
  })
  it('handles total smaller than weight count (floors all zero)', () => {
    expect(apportion(1, [1, 1, 1])).toEqual([1, 0, 0])
    expect(apportion(2, [1, 1, 1])).toEqual([1, 1, 0])
  })
})
