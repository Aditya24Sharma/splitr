import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { getDb } from '../worker/db'
import type { PlaidAccount, PlaidTransaction } from '../worker/plaid'
import {
  deleteTransactions,
  moveSplitsToPosted,
  syncAllItems,
  upsertAccounts,
  upsertSnapshots,
  upsertTransactions,
} from '../worker/sync'

// Runs the sync's bulk SQL against a real local D1 (SQLite in Cloudflare's
// runtime), in a throwaway directory.

const persistDir = mkdtempSync(path.join(tmpdir(), 'splitr-sync-test-'))
let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>
let db: D1Database

const acct = (id: string, current: number): PlaidAccount => ({
  account_id: id,
  name: `Card ${id}`,
  official_name: null,
  mask: '1004',
  type: 'credit',
  subtype: 'credit card',
  balances: { current, available: null, iso_currency_code: 'USD' },
})

const tx = (id: string, over: Partial<PlaidTransaction> = {}): PlaidTransaction => ({
  transaction_id: id,
  account_id: 'acc-1',
  date: '2026-10-10',
  amount: 12.34,
  name: `Shop ${id}`,
  merchant_name: `Shop ${id}`,
  personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' },
  pending: false,
  iso_currency_code: 'USD',
  ...over,
})

async function rows<T>(query: string, ...params: unknown[]): Promise<T[]> {
  return (await db.prepare(query).bind(...params).all<T>()).results
}

/** Links a split to the transaction with this Plaid id. */
async function splitOn(plaidId: string, expenseId: string) {
  await db.batch([
    db.prepare(`INSERT INTO "Expense" ("id", "type", "payerId", "totalCents", "splitMethod", "createdAt", "transactionId")
      SELECT ?, 'SIMPLE', 'p1', 1234, 'EVEN', '2026-10-10T00:00:00.000Z', "id" FROM "Transaction" WHERE "plaidTransactionId" = ?`).bind(expenseId, plaidId),
    db.prepare(`INSERT INTO "ExpenseParticipant" ("expenseId", "personId") VALUES (?, 'p1')`).bind(expenseId),
  ])
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: { path: persistDir } })
  db = proxy.env.DB
})

afterAll(async () => {
  await proxy?.dispose()
  rmSync(persistDir, { recursive: true, force: true })
})

beforeEach(async () => {
  // Fresh tables for every test, from the real migration. D1 always enforces
  // foreign keys, so children are dropped before their parents.
  const tables = ['_ExpenseToTag', 'ExpenseParticipant', 'ItemAssignment', 'Item', 'Expense', 'BalanceSnapshot',
    'Transaction', 'Account', 'PlaidItem', 'Tag', 'Person']
  for (const name of tables) await db.prepare(`DROP TABLE IF EXISTS "${name}"`).run()
  const migration = readFileSync(path.join(import.meta.dirname, '../migrations/0001_init.sql'), 'utf8')
  for (const stmt of migration.split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
    await db.prepare(stmt).run()
  }
  await db.batch([
    db.prepare(`INSERT INTO "Person" ("id", "name") VALUES ('p1', 'Aditya')`),
    db.prepare(`INSERT INTO "PlaidItem" ("id", "itemId", "accessToken") VALUES (1, 'item-1', 'secret')`),
  ])
  await db.batch([upsertAccounts(db, 1, [acct('acc-1', 100)], '2026-10-10T00:00:00.000Z')])
})

describe('sync SQL', () => {
  it('inserts new transactions and updates known ones without duplicating', async () => {
    await db.batch([upsertTransactions(db, [tx('t1'), tx('t2')], 'now')])
    await db.prepare(`UPDATE "Transaction" SET "userCategory" = 'TRAVEL' WHERE "plaidTransactionId" = 't1'`).run()

    await db.batch([upsertTransactions(db, [tx('t1', { amount: 20, pending: true }), tx('t3')], 'now')])

    const all = await rows<{ plaidTransactionId: string; amount: number; pending: number; userCategory: string | null; accountId: number }>(
      `SELECT * FROM "Transaction" ORDER BY "plaidTransactionId"`,
    )
    expect(all.map((t) => t.plaidTransactionId)).toEqual(['t1', 't2', 't3'])
    expect(all[0]).toMatchObject({ amount: 2000, pending: 1, userCategory: 'TRAVEL' })
    expect(all.every((t) => t.accountId === 1)).toBe(true)
  })

  it('skips transactions on accounts it does not know', async () => {
    await db.batch([upsertTransactions(db, [tx('t1', { account_id: 'stranger' })], 'now')])
    expect(await rows(`SELECT * FROM "Transaction"`)).toEqual([])
  })

  it('updates account balances and keeps one snapshot per day', async () => {
    await db.batch([
      upsertAccounts(db, 1, [acct('acc-1', 250.5)], 'later'),
      upsertSnapshots(db, [acct('acc-1', 250.5)], '2026-10-10'),
    ])
    await db.batch([upsertSnapshots(db, [acct('acc-1', 300)], '2026-10-10')])

    expect(await rows(`SELECT "currentBalance", "updatedAt" FROM "Account"`)).toEqual([{ currentBalance: 25050, updatedAt: 'later' }])
    expect(await rows(`SELECT "date", "currentBalance" FROM "BalanceSnapshot"`)).toEqual([{ date: '2026-10-10', currentBalance: 30000 }])
  })

  it('moves a split from a pending charge to the posted one', async () => {
    await db.batch([upsertTransactions(db, [tx('pend', { pending: true })], 'now')])
    await splitOn('pend', 'e1')

    // Plaid posts it: adds the posted transaction and removes the pending one
    await db.batch([
      upsertTransactions(db, [tx('posted', { pending_transaction_id: 'pend' })], 'now'),
      moveSplitsToPosted(db, [{ pending: 'pend', posted: 'posted' }]),
      deleteTransactions(db, ['pend']),
    ])

    const [split] = await rows<{ plaidTransactionId: string }>(
      `SELECT t."plaidTransactionId" FROM "Expense" e JOIN "Transaction" t ON t."id" = e."transactionId" WHERE e."id" = 'e1'`,
    )
    expect(split?.plaidTransactionId).toBe('posted')
  })

  it('leaves a posted charge that is already split alone', async () => {
    await db.batch([upsertTransactions(db, [tx('pend', { pending: true }), tx('posted')], 'now')])
    await splitOn('pend', 'e1')
    await splitOn('posted', 'e2')

    await db.batch([
      moveSplitsToPosted(db, [{ pending: 'pend', posted: 'posted' }]),
      deleteTransactions(db, ['pend']),
    ])

    expect(await rows(`SELECT "id", "transactionId" IS NOT NULL AS linked FROM "Expense" ORDER BY "id"`)).toEqual([
      { id: 'e1', linked: 0 },
      { id: 'e2', linked: 1 },
    ])
  })

  it('keeps a split when the bank removes its charge, just unlinked', async () => {
    await db.batch([upsertTransactions(db, [tx('t1')], 'now')])
    await splitOn('t1', 'e1')

    await db.batch([deleteTransactions(db, ['t1'])])

    expect(await rows(`SELECT "id", "transactionId" FROM "Expense"`)).toEqual([{ id: 'e1', transactionId: null }])
  })

  it('writes nothing when any statement in the batch fails', async () => {
    const bad = db.prepare(`INSERT INTO "Transaction" ("source") VALUES ('PLAID')`) // misses NOT NULL columns
    await expect(db.batch([upsertTransactions(db, [tx('t1')], 'now'), bad])).rejects.toThrow()
    expect(await rows(`SELECT * FROM "Transaction"`)).toEqual([])
  })
})

describe('syncAllItems', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('syncs the other banks when one needs a login, and says which', async () => {
    vi.stubEnv('PLAID_CLIENT_ID', 'id')
    vi.stubEnv('PLAID_SECRET', 'secret')
    vi.stubEnv('PLAID_ENV', 'sandbox')
    await db.prepare(`INSERT INTO "PlaidItem" ("id", "itemId", "accessToken", "institutionName") VALUES (2, 'item-2', 'broken', 'Chase')`).run()

    // A fake Plaid; anything else (the local D1) goes to the real fetch
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (!url.includes('plaid.com')) return realFetch(input, init)
      const body = JSON.parse(String(init?.body))
      if (body.access_token === 'broken') {
        return Response.json({ error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'login required' }, { status: 400 })
      }
      if (url.endsWith('/accounts/get')) return Response.json({ accounts: [acct('acc-1', 250)] })
      return Response.json({ added: [tx('t1')], modified: [], removed: [], next_cursor: 'c1', has_more: false })
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const results = await syncAllItems(getDb(db))

    expect(results).toEqual([
      { itemId: 1, institutionName: null, added: 1, modified: 0, removed: 0 },
      { itemId: 2, institutionName: 'Chase', added: 0, modified: 0, removed: 0, error: 'login_required' },
    ])
    expect(await rows(`SELECT "plaidTransactionId" FROM "Transaction"`)).toEqual([{ plaidTransactionId: 't1' }])
    expect(logged.mock.calls[0][0]).toBe(
      '[plaid] sync Chase (item 2) failed: ITEM_LOGIN_REQUIRED: Plaid /accounts/get failed: login required',
    )
  })
})
