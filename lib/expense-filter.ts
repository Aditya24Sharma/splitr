export interface FilterableExpense {
  store: string | null
  description: string | null
  payerId: string
  loggedToSplitwise: boolean
  /** ISO string; a calendar date saved as UTC midnight */
  purchasedAt: string | null
  /** ISO string */
  createdAt: string
  tags: string[]
  itemNames: string[]
  breakdown: { perPerson: { personId: string }[] }
}

export interface ExpenseFilters {
  /** Keep expenses with ANY of these tags; empty = no tag filter */
  tags: string[]
  /** Matches store, description, or an item name (case-insensitive) */
  query: string
  /** Inclusive YYYY-MM-DD bounds; '' = open-ended */
  from: string
  to: string
  /** Keep expenses that ALL of these people paid for or share in; empty = anyone */
  personIds: string[]
  /** Keep expenses paid by ANY of these people; empty = anyone */
  payerIds: string[]
  logged: 'all' | 'logged' | 'not-logged'
}

export const NO_FILTERS: ExpenseFilters = {
  tags: [],
  query: '',
  from: '',
  to: '',
  personIds: [],
  payerIds: [],
  logged: 'all',
}

export interface ExpenseMatch<T> {
  expense: T
  /** Item names containing the search text; empty when there is no search */
  matchedItems: string[]
}

/**
 * The expense's day as YYYY-MM-DD: its own date if it has one, otherwise the
 * local day it was entered.
 */
export function expenseDay(e: Pick<FilterableExpense, 'purchasedAt' | 'createdAt'>): string {
  if (e.purchasedAt) return e.purchasedAt.slice(0, 10)
  const d = new Date(e.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Expenses matching every active filter, newest day first. */
export function filterExpenses<T extends FilterableExpense>(
  expenses: T[],
  f: ExpenseFilters,
): ExpenseMatch<T>[] {
  const q = f.query.trim().toLowerCase()
  const result: (ExpenseMatch<T> & { day: string })[] = []
  for (const expense of expenses) {
    if (f.tags.length > 0 && !expense.tags.some(t => f.tags.includes(t))) continue

    const day = expenseDay(expense)
    if (f.from && day < f.from) continue
    if (f.to && day > f.to) continue

    if (f.payerIds.length > 0 && !f.payerIds.includes(expense.payerId)) continue
    if (
      f.personIds.length > 0 &&
      !f.personIds.every(
        id => expense.payerId === id || expense.breakdown.perPerson.some(p => p.personId === id),
      )
    ) continue

    if (f.logged === 'logged' && !expense.loggedToSplitwise) continue
    if (f.logged === 'not-logged' && expense.loggedToSplitwise) continue

    const matchedItems = q ? expense.itemNames.filter(n => n.toLowerCase().includes(q)) : []
    const nameMatches = [expense.store, expense.description].some(n => n?.toLowerCase().includes(q))
    if (q && !nameMatches && matchedItems.length === 0) continue

    result.push({ expense, matchedItems, day })
  }
  // Newest day first; same day keeps the incoming (newest-entered first) order
  return result
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    .map(({ expense, matchedItems }) => ({ expense, matchedItems }))
}
