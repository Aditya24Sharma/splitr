import { toCents } from '@/lib/money'
import { todayLocal } from '@/lib/spending'
import type { Db } from './db'
import { plaidItem } from './db/schema'
import { PlaidApiError, plaid, type PlaidAccount, type PlaidTransaction } from './plaid'

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

// Each statement below takes a whole list as one JSON parameter and reads it
// with json_each, so a sync is a handful of statements however many
// transactions it brings. D1 allows 50 queries per request on the free plan,
// and a first sync can bring hundreds.
//
// They are D1 statements rather than Drizzle ones: Drizzle can't put a raw
// SQL statement with parameters into a batch.

export function upsertAccounts(d1: D1Database, itemId: number, accounts: PlaidAccount[], updatedAt: string) {
  const rows = accounts.map((a) => ({ plaidAccountId: a.account_id, ...accountFields(a) }))
  return d1.prepare(`
    INSERT INTO "Account" ("plaidAccountId", "itemId", "name", "officialName", "mask", "type", "subtype",
      "currentBalance", "availableBalance", "isoCurrencyCode", "updatedAt")
    SELECT j.value ->> 'plaidAccountId', ?, j.value ->> 'name', j.value ->> 'officialName',
      j.value ->> 'mask', j.value ->> 'type', j.value ->> 'subtype', j.value ->> 'currentBalance',
      j.value ->> 'availableBalance', j.value ->> 'isoCurrencyCode', ?
    FROM json_each(?) j WHERE true
    ON CONFLICT ("plaidAccountId") DO UPDATE SET
      "name" = excluded."name", "officialName" = excluded."officialName", "mask" = excluded."mask",
      "type" = excluded."type", "subtype" = excluded."subtype", "currentBalance" = excluded."currentBalance",
      "availableBalance" = excluded."availableBalance", "isoCurrencyCode" = excluded."isoCurrencyCode",
      "updatedAt" = excluded."updatedAt"`).bind(itemId, updatedAt, JSON.stringify(rows))
}

/** One balance per account per day; a repeat sync the same day keeps the latest. */
export function upsertSnapshots(d1: D1Database, accounts: PlaidAccount[], date: string) {
  const rows = accounts.map((a) => ({
    plaidAccountId: a.account_id,
    currentBalance: cents(a.balances.current),
    availableBalance: cents(a.balances.available),
  }))
  return d1.prepare(`
    INSERT INTO "BalanceSnapshot" ("accountId", "date", "currentBalance", "availableBalance")
    SELECT a."id", ?, j.value ->> 'currentBalance', j.value ->> 'availableBalance'
    FROM json_each(?) j
    JOIN "Account" a ON a."plaidAccountId" = j.value ->> 'plaidAccountId' WHERE true
    ON CONFLICT ("accountId", "date") DO UPDATE SET
      "currentBalance" = excluded."currentBalance", "availableBalance" = excluded."availableBalance"`).bind(date, JSON.stringify(rows))
}

/** Transactions on accounts we don't know are skipped by the JOIN. */
export function upsertTransactions(d1: D1Database, txs: PlaidTransaction[], createdAt: string) {
  const rows = txs.map((tx) => ({
    plaidTransactionId: tx.transaction_id,
    plaidAccountId: tx.account_id,
    date: tx.date,
    amount: toCents(tx.amount),
    name: tx.name,
    merchantName: tx.merchant_name ?? null,
    categoryPrimary: tx.personal_finance_category?.primary ?? null,
    categoryDetailed: tx.personal_finance_category?.detailed ?? null,
    pending: tx.pending ? 1 : 0,
    isoCurrencyCode: tx.iso_currency_code ?? 'USD',
  }))
  // Never touches userCategory, so your recategorizing survives syncs
  return d1.prepare(`
    INSERT INTO "Transaction" ("source", "plaidTransactionId", "accountId", "date", "amount", "name",
      "merchantName", "categoryPrimary", "categoryDetailed", "pending", "isoCurrencyCode", "createdAt")
    SELECT 'PLAID', j.value ->> 'plaidTransactionId', a."id", j.value ->> 'date', j.value ->> 'amount',
      j.value ->> 'name', j.value ->> 'merchantName', j.value ->> 'categoryPrimary',
      j.value ->> 'categoryDetailed', j.value ->> 'pending', j.value ->> 'isoCurrencyCode', ?
    FROM json_each(?) j
    JOIN "Account" a ON a."plaidAccountId" = j.value ->> 'plaidAccountId' WHERE true
    ON CONFLICT ("plaidTransactionId") DO UPDATE SET
      "accountId" = excluded."accountId", "date" = excluded."date", "amount" = excluded."amount",
      "name" = excluded."name", "merchantName" = excluded."merchantName",
      "categoryPrimary" = excluded."categoryPrimary", "categoryDetailed" = excluded."categoryDetailed",
      "pending" = excluded."pending", "isoCurrencyCode" = excluded."isoCurrencyCode"`).bind(createdAt, JSON.stringify(rows))
}

/**
 * When a pending charge posts, Plaid removes the pending transaction and adds
 * a new one pointing back at it. Moves any split to the posted one before the
 * pending row is deleted. A posted charge that already has a split keeps it.
 */
export function moveSplitsToPosted(d1: D1Database, pairs: { pending: string; posted: string }[]) {
  const json = JSON.stringify(pairs)
  return d1.prepare(`
    UPDATE "Expense" SET "transactionId" = (
      SELECT posted."id" FROM json_each(?) j
      JOIN "Transaction" pend ON pend."plaidTransactionId" = j.value ->> 'pending'
      JOIN "Transaction" posted ON posted."plaidTransactionId" = j.value ->> 'posted'
      WHERE pend."id" = "Expense"."transactionId"
        AND NOT EXISTS (SELECT 1 FROM "Expense" e2 WHERE e2."transactionId" = posted."id"))
    WHERE "transactionId" IN (
      SELECT pend."id" FROM json_each(?) j
      JOIN "Transaction" pend ON pend."plaidTransactionId" = j.value ->> 'pending')`).bind(json, json)
}

/** A split made from a removed transaction stays; its link is cleared. */
export function deleteTransactions(d1: D1Database, plaidIds: string[]) {
  return d1.prepare(`
    DELETE FROM "Transaction"
    WHERE "plaidTransactionId" IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(plaidIds))
}

export async function syncItem(db: Db, itemDbId: number): Promise<SyncResult> {
  const item = await db.query.plaidItem.findFirst({ where: (i, { eq }) => eq(i.id, itemDbId) })
  if (!item) throw new Error(`Plaid item ${itemDbId} not found`)

  const { accounts } = await plaid.accountsGet(item.accessToken)

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

  // Everything for this bank is written in one batch: if any part fails,
  // nothing changes and the cursor stays put, so the next sync retries it all.
  const now = new Date().toISOString()
  const pendingPairs = added
    .filter((tx) => tx.pending_transaction_id)
    .map((tx) => ({ pending: tx.pending_transaction_id!, posted: tx.transaction_id }))
  const removedIds = removed.map((r) => r.transaction_id).filter(Boolean)
  const changed = [...added, ...modified]

  const d1 = db.$client
  await d1.batch([
    upsertAccounts(d1, item.id, accounts, now),
    upsertSnapshots(d1, accounts, todayLocal()),
    ...(changed.length > 0 ? [upsertTransactions(d1, changed, now)] : []),
    ...(pendingPairs.length > 0 ? [moveSplitsToPosted(d1, pendingPairs)] : []),
    ...(removedIds.length > 0 ? [deleteTransactions(d1, removedIds)] : []),
    d1.prepare('UPDATE "PlaidItem" SET "cursor" = ? WHERE "id" = ?').bind(cursor ?? null, item.id),
  ])

  return { itemId: item.id, added: added.length, modified: modified.length, removed: removed.length }
}

export async function syncAllItems(db: Db): Promise<SyncResult[]> {
  const items = await db.select({ id: plaidItem.id }).from(plaidItem)
  const results: SyncResult[] = []
  for (const item of items) results.push(await syncItem(db, item.id))
  return results
}
