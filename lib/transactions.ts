// The transaction shape the API returns, shared by server and client.

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

/**
 * A short, human name for a transaction. Bank descriptions are often long
 * codes ("ORIG CO NAME:ACME CO ENTRY DESCR:..."), so prefer the merchant.
 */
export function txLabel(tx: Pick<TxView, 'merchantName' | 'name'>): string {
  return tx.merchantName || tx.name
}
