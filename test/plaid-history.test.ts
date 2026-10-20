import { describe, it, expect } from 'vitest'
import { earliestHistoryStart, historyDays } from '@/lib/plaid-history'

describe('historyDays', () => {
  it('counts the start day and today', () => {
    expect(historyDays('2026-10-20', '2026-10-20')).toBe(1)
    expect(historyDays('2026-01-01', '2026-10-20')).toBe(293)
  })
  it('keeps within Plaid range', () => {
    expect(historyDays('2020-01-01', '2026-10-20')).toBe(730)
    expect(historyDays('2026-12-01', '2026-10-20')).toBe(1)
  })
  it('rejects a value that is not a date', () => {
    expect(historyDays('jan 2026', '2026-10-20')).toBeNull()
    expect(historyDays('', '2026-10-20')).toBeNull()
  })
})

describe('earliestHistoryStart', () => {
  it('is the start that gives exactly 730 days', () => {
    const start = earliestHistoryStart('2026-10-20')
    expect(start).toBe('2024-10-21')
    expect(historyDays(start, '2026-10-20')).toBe(730)
  })
})
