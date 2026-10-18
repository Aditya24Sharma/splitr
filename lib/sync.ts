import { prisma } from '@/lib/db'
import { PlaidApiError, plaid, type PlaidAccount, type PlaidTransaction } from '@/lib/plaid'
import { toCents } from '@/lib/money'
import { todayLocal } from '@/lib/spending'

export interface SyncResult {
  itemId: number
  added: number
  modified: number
  removed: number
}

const cents = (v: number | null | undefined) => (v != null ? toCents(v) : null)

/** The Account columns that come from Plaid; shared by link and sync. */
export function accountFields(acct: PlaidAccount) {
  return {
    name: acct.name,
    officialName: acct.official_name ?? null,
    mask: acct.mask ?? null,
    type: acct.type,
    subtype: acct.subtype ?? null,
    currentBalance: cents(acct.balances.current),
    availableBalance: cents(acct.balances.available),
    isoCurrencyCode: acct.balances.iso_currency_code ?? 'USD',
  }
}

function txFields(tx: PlaidTransaction, accountId: number) {
  return {
    accountId,
    date: tx.date,
    amount: toCents(tx.amount),
    name: tx.name,
    merchantName: tx.merchant_name ?? null,
    categoryPrimary: tx.personal_finance_category?.primary ?? null,
    categoryDetailed: tx.personal_finance_category?.detailed ?? null,
    pending: tx.pending ?? false,
    isoCurrencyCode: tx.iso_currency_code ?? 'USD',
  }
}

export async function syncItem(itemDbId: number): Promise<SyncResult> {
  const item = await prisma.plaidItem.findUnique({ where: { id: itemDbId } })
  if (!item) throw new Error(`Plaid item ${itemDbId} not found`)

  const { accounts } = await plaid.accountsGet(item.accessToken)
  const snapshotDate = todayLocal()
  const accountMap = new Map<string, number>()
  for (const acct of accounts) {
    const fields = accountFields(acct)
    const row = await prisma.account.upsert({
      where: { plaidAccountId: acct.account_id },
      create: { plaidAccountId: acct.account_id, itemId: item.id, ...fields },
      update: { ...fields, updatedAt: new Date() },
    })
    accountMap.set(acct.account_id, row.id)

    // One balance per account per day; a repeat sync the same day overwrites
    // it, keeping the latest reading.
    const balances = { currentBalance: fields.currentBalance, availableBalance: fields.availableBalance }
    await prisma.balanceSnapshot.upsert({
      where: { accountId_date: { accountId: row.id, date: snapshotDate } },
      create: { accountId: row.id, date: snapshotDate, ...balances },
      update: balances,
    })
  }

  const added: PlaidTransaction[] = []
  const modified: PlaidTransaction[] = []
  const removed: { transaction_id: string }[] = []

  let cursor: string | undefined = item.cursor ?? undefined
  let hasMore = true
  let pages = 0
  while (hasMore) {
    let resp
    try {
      resp = await plaid.transactionsSync(item.accessToken, cursor)
    } catch (error) {
      // Right after linking Plaid is still pulling history and returns
      // PRODUCT_NOT_READY. Treat it as "no data yet"; the cursor is left
      // untouched so a later sync picks up where this one left off.
      if (error instanceof PlaidApiError && error.code === 'PRODUCT_NOT_READY') break
      throw error
    }
    added.push(...resp.added)
    modified.push(...resp.modified)
    removed.push(...resp.removed)
    cursor = resp.next_cursor
    hasMore = resp.has_more
    pages += 1
    if (pages > 50) break
  }

  for (const tx of [...added, ...modified]) {
    const accountId = accountMap.get(tx.account_id)
    if (!accountId) continue
    const fields = txFields(tx, accountId)
    await prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      create: { source: 'PLAID', plaidTransactionId: tx.transaction_id, ...fields },
      update: fields,
    })
  }

  // When a pending charge posts, Plaid removes the pending transaction and adds
  // a new one pointing back at it. Move any split over before the old row goes.
  for (const tx of added) {
    if (!tx.pending_transaction_id) continue
    const old = await prisma.transaction.findUnique({
      where: { plaidTransactionId: tx.pending_transaction_id },
      select: { expense: { select: { id: true } } },
    })
    if (!old?.expense) continue
    const posted = await prisma.transaction.findUnique({
      where: { plaidTransactionId: tx.transaction_id },
      select: { id: true },
    })
    if (posted) {
      await prisma.expense.update({ where: { id: old.expense.id }, data: { transactionId: posted.id } })
    }
  }

  // A split made from a removed transaction stays; its link is cleared.
  const removedIds = removed.map(r => r.transaction_id).filter((id): id is string => Boolean(id))
  if (removedIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { plaidTransactionId: { in: removedIds } } })
  }

  await prisma.plaidItem.update({ where: { id: item.id }, data: { cursor: cursor ?? null } })

  return { itemId: item.id, added: added.length, modified: modified.length, removed: removed.length }
}

export async function syncAllItems(): Promise<SyncResult[]> {
  const items = await prisma.plaidItem.findMany({ select: { id: true } })
  const results: SyncResult[] = []
  for (const item of items) results.push(await syncItem(item.id))
  return results
}
