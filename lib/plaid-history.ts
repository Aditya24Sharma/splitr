// How far back Plaid fetches transactions when a bank is first linked. Plaid
// takes a number of days back from today, from 1 to 730; Banks offers a date.

export const DEFAULT_HISTORY_START = '2026-01-01'
export const MAX_HISTORY_DAYS = 730

const DAY_MS = 86_400_000

function parseDate(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

/** Days from a YYYY-MM-DD start through today, both counted, kept within Plaid's range; null if start isn't a date. */
export function historyDays(start: string, today: string): number | null {
  const from = parseDate(start)
  const to = parseDate(today)
  if (from == null || to == null) return null
  const days = Math.round((to - from) / DAY_MS) + 1
  return Math.min(Math.max(days, 1), MAX_HISTORY_DAYS)
}

/** The earliest start Plaid can reach from today (YYYY-MM-DD). */
export function earliestHistoryStart(today: string): string {
  const to = parseDate(today) ?? Date.now()
  return new Date(to - (MAX_HISTORY_DAYS - 1) * DAY_MS).toISOString().slice(0, 10)
}
