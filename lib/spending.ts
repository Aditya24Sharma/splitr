import type { Cents } from '@/lib/money'

// Plaid's personal_finance_category "primary" values. Amounts follow Plaid's
// sign: positive = money out, negative = money in.

export interface SpendingTx {
  /** YYYY-MM-DD */
  date: string
  amount: Cents
  categoryPrimary: string | null
  categoryDetailed: string | null
  /** What friends owe back on this charge once it's split; 0 if not split */
  owedBackCents: Cents
}

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  FOOD_AND_DRINK: { label: 'Food & drink', color: '#FFD731' },
  GENERAL_MERCHANDISE: { label: 'Shopping', color: '#E9CCFF' },
  GROCERIES: { label: 'Groceries', color: '#55DB9C' },
  TRANSPORTATION: { label: 'Transport', color: '#DCEEFF' },
  TRAVEL: { label: 'Travel', color: '#9CD3FF' },
  RENT_AND_UTILITIES: { label: 'Rent & bills', color: '#FFB9A3' },
  ENTERTAINMENT: { label: 'Fun', color: '#FF9BD2' },
  PERSONAL_CARE: { label: 'Personal care', color: '#FFE7A3' },
  GENERAL_SERVICES: { label: 'Services', color: '#C9C2FF' },
  MEDICAL: { label: 'Medical', color: '#B8F0D8' },
  HOME_IMPROVEMENT: { label: 'Home', color: '#F5D0B5' },
  GOVERNMENT_AND_NON_PROFIT: { label: 'Gov & charity', color: '#D7E3C8' },
  LOAN_PAYMENTS: { label: 'Loan payments', color: '#D6D3CC' },
  BANK_FEES: { label: 'Bank fees', color: '#FFC9C9' },
  INCOME: { label: 'Income', color: '#55DB9C' },
  TRANSFER_IN: { label: 'Transfer in', color: '#F2F2EF' },
  TRANSFER_OUT: { label: 'Transfer out', color: '#F2F2EF' },
  OTHER: { label: 'Other', color: '#F2F2EF' },
}

/** Every category a transaction can be moved to, in display order. */
export const ALL_CATEGORIES = Object.keys(CATEGORY_INFO)

/** Categories offered when adding an expense by hand, most common first. */
export const MANUAL_CATEGORIES = [
  'FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE',
  'TRANSPORTATION',
  'ENTERTAINMENT',
  'RENT_AND_UTILITIES',
  'TRAVEL',
  'PERSONAL_CARE',
  'MEDICAL',
  'GENERAL_SERVICES',
  'OTHER',
] as const

export function categoryLabel(c: string | null | undefined): string {
  if (!c) return 'Uncategorized'
  if (CATEGORY_INFO[c]) return CATEGORY_INFO[c].label
  const words = c.toLowerCase().split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function categoryColor(c: string | null | undefined): string {
  return (c && CATEGORY_INFO[c]?.color) || '#F2F2EF'
}

/**
 * Money moving between your own accounts, not money spent or earned. Paying a
 * credit card bill would otherwise count the same purchases twice.
 */
export function isMoneyMoving(tx: Pick<SpendingTx, 'categoryPrimary' | 'categoryDetailed'>): boolean {
  return (
    tx.categoryPrimary === 'TRANSFER_IN' ||
    tx.categoryPrimary === 'TRANSFER_OUT' ||
    tx.categoryDetailed === 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'
  )
}

export function isSpending(tx: Pick<SpendingTx, 'amount' | 'categoryPrimary' | 'categoryDetailed'>): boolean {
  return tx.amount > 0 && !isMoneyMoving(tx)
}

/** Your part of a charge: the full amount minus what friends owe back. */
export function yourShare(tx: Pick<SpendingTx, 'amount' | 'owedBackCents'>): Cents {
  return Math.max(0, tx.amount - tx.owedBackCents)
}

export interface MonthSummary {
  spentCents: Cents
  owedBackCents: Cents
  yourShareCents: Cents
  incomeCents: Cents
  /** Spending by category, largest first, counting only your share */
  byCategory: { category: string | null; cents: Cents }[]
}

/** month is YYYY-MM */
export function summarizeMonth(txs: SpendingTx[], month: string): MonthSummary {
  let spentCents = 0
  let owedBackCents = 0
  let incomeCents = 0
  const byCat = new Map<string | null, number>()
  for (const tx of txs) {
    if (!tx.date.startsWith(month)) continue
    if (isSpending(tx)) {
      const share = yourShare(tx)
      spentCents += tx.amount
      owedBackCents += tx.amount - share
      byCat.set(tx.categoryPrimary, (byCat.get(tx.categoryPrimary) ?? 0) + share)
    } else if (tx.amount < 0 && !isMoneyMoving(tx)) {
      incomeCents += -tx.amount
    }
  }
  const byCategory = [...byCat.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .filter(c => c.cents > 0)
    .sort((a, b) => b.cents - a.cents)
  return { spentCents, owedBackCents, yourShareCents: spentCents - owedBackCents, incomeCents, byCategory }
}

/** Assets minus debts, from account balances in cents. */
export function netBalance(accounts: { type: string; currentBalance: Cents | null }[]): Cents {
  let net = 0
  for (const a of accounts) {
    if (a.currentBalance == null) continue
    net += a.type === 'credit' || a.type === 'loan' ? -a.currentBalance : a.currentBalance
  }
  return net
}

/** Local calendar day as YYYY-MM-DD (not UTC; matches Plaid's date strings). */
export function todayLocal(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** YYYY-MM shifted by a number of months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
