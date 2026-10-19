import type { Prisma } from '@prisma/client'
import { computeBreakdown } from '@/lib/expense-breakdown'

/** Prisma include that loads what txView needs to describe a linked split. */
export const TX_INCLUDE = {
  expense: {
    include: {
      items: { include: { assignments: true } },
      participants: true,
    },
  },
} satisfies Prisma.TransactionInclude

type TxRow = Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>

export interface TxView {
  id: number
  source: 'PLAID' | 'MANUAL'
  date: string
  amount: number
  name: string
  merchantName: string | null
  categoryPrimary: string | null
  categoryDetailed: string | null
  pending: boolean
  accountId: number | null
  split: {
    expenseId: string
    /** How many people share it, the payer included */
    ways: number
    /** Everyone's shares except the payer's: what comes back to you */
    owedBackCents: number
    logged: boolean
  } | null
}

/** A transaction as the client sees it; never includes Plaid tokens. */
export function txView(tx: TxRow): TxView {
  let split: TxView['split'] = null
  if (tx.expense) {
    const breakdown = computeBreakdown({
      ...tx.expense,
      items: tx.expense.items.map(i => ({
        id: i.id,
        lineTotalCents: i.lineTotalCents,
        assignments: i.assignments,
      })),
    })
    split = {
      expenseId: tx.expense.id,
      ways: breakdown.perPerson.length,
      owedBackCents: breakdown.owes.reduce((s, o) => s + o.cents, 0),
      logged: tx.expense.loggedToSplitwise,
    }
  }
  return {
    id: tx.id,
    source: tx.source,
    date: tx.date,
    amount: tx.amount,
    name: tx.name,
    merchantName: tx.merchantName,
    categoryPrimary: tx.userCategory ?? tx.categoryPrimary,
    // The bank's detailed category no longer applies once you've recategorized
    categoryDetailed: tx.userCategory ? null : tx.categoryDetailed,
    pending: tx.pending,
    accountId: tx.accountId,
    split,
  }
}

/**
 * A short, human name for a transaction. Bank descriptions are often long
 * codes ("ORIG CO NAME:ACME CO ENTRY DESCR:..."), so prefer the merchant.
 */
export function txLabel(tx: Pick<TxView, 'merchantName' | 'name'>): string {
  return tx.merchantName || tx.name
}
