import { Cents } from '@/lib/money'

export interface SettleExpense {
  payerId: string
  perPerson: { personId: string; cents: Cents }[]
}

export interface Debt { fromId: string; toId: string; cents: Cents }

/**
 * Totals what each person owes each payer across several expenses, netting
 * opposite directions per pair (A owes B 30, B owes A 10 => A owes B 20).
 * Sorted largest first, then by ids for a stable order.
 */
export function settleExpenses(expenses: SettleExpense[]): Debt[] {
  // Keyed by the pair in sorted order; positive = lower id owes higher id.
  const net = new Map<string, number>()
  for (const e of expenses) {
    for (const { personId, cents } of e.perPerson) {
      if (personId === e.payerId || cents === 0) continue
      const [a, b] = [personId, e.payerId].sort()
      const key = `${a}\u0000${b}`
      net.set(key, (net.get(key) ?? 0) + (personId === a ? cents : -cents))
    }
  }
  const debts: Debt[] = []
  for (const [key, cents] of net) {
    if (cents === 0) continue
    const [a, b] = key.split('\u0000')
    debts.push(cents > 0 ? { fromId: a, toId: b, cents } : { fromId: b, toId: a, cents: -cents })
  }
  return debts.sort(
    (x, y) => (y.cents - x.cents) || x.fromId.localeCompare(y.fromId) || x.toId.localeCompare(y.toId),
  )
}
