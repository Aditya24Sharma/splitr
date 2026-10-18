import type { TxView } from '@/lib/transactions'

/** Loads the Money charge a new split starts from (?fromTx=<id>). */
export async function loadSourceTx(id: string): Promise<TxView> {
  const r = await fetch(`/api/transactions/${id}`)
  if (r.status === 404) throw new Error('That charge no longer exists.')
  if (!r.ok) throw new Error(`Failed to load the charge (HTTP ${r.status})`)
  const tx = (await r.json()) as TxView
  if (tx.split) throw new Error('This charge is already split.')
  return tx
}
