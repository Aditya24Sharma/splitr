import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import type { PlaidAccount, PlaidTransaction } from '../worker/plaid'
import { upsertAccounts, upsertTransactions } from '../worker/sync'
import { applySql, leftoverSql, matchesSql, problem, type Match } from '../scripts/move-splits'

// Runs the move script's SQL against a real local D1, with the old link as
// item 1 and the new link of the same card as item 2.

const persistDir = mkdtempSync(path.join(tmpdir(), 'splitr-move-test-'))
let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>
let db: D1Database

const acct = (id: string): PlaidAccount => ({
  account_id: id,
  name: 'Gold Card',
  official_name: null,
  mask: '1004',
  type: 'credit',
  subtype: 'credit card',
  balances: { current: 100, available: null, iso_currency_code: 'USD' },
})

const tx = (id: string, account: string, over: Partial<PlaidTransaction> = {}): PlaidTransaction => ({
  transaction_id: id,
  account_id: account,
  date: '2026-10-10',
  amount: 12.34,
  name: 'Shop',
  merchant_name: 'Shop',
  personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANT' },
  pending: false,
  iso_currency_code: 'USD',
  ...over,
})

async function rows<T>(query: string): Promise<T[]> {
  return (await db.prepare(query).all<T>()).results
}

async function splitOn(plaidId: string, expenseId: string) {
  await db.prepare(`INSERT INTO "Expense" ("id", "type", "payerId", "totalCents", "splitMethod", "transactionId")
    SELECT ?, 'SIMPLE', 'p1', 1234, 'EVEN', "id" FROM "Transaction" WHERE "plaidTransactionId" = ?`).bind(expenseId, plaidId).run()
}

const matches = () => rows<Match>(matchesSql(1, 2))

/** The Plaid id of the charge each split points at. */
const splitTargets = () =>
  rows<{ id: string; plaidTransactionId: string }>(
    `SELECT e."id", t."plaidTransactionId" FROM "Expense" e JOIN "Transaction" t ON t."id" = e."transactionId" ORDER BY e."id"`,
  )

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: { path: persistDir } })
  db = proxy.env.DB
})

afterAll(async () => {
  await proxy?.dispose()
  rmSync(persistDir, { recursive: true, force: true })
})

beforeEach(async () => {
  const tables = ['_ExpenseToTag', 'ExpenseParticipant', 'ItemAssignment', 'Item', 'Expense', 'BalanceSnapshot',
    'Transaction', 'Account', 'PlaidItem', 'Tag', 'Person']
  for (const name of tables) await db.prepare(`DROP TABLE IF EXISTS "${name}"`).run()
  const migration = readFileSync(path.join(import.meta.dirname, '../migrations/0001_init.sql'), 'utf8')
  for (const stmt of migration.split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
    await db.prepare(stmt).run()
  }
  await db.batch([
    db.prepare(`INSERT INTO "Person" ("id", "name") VALUES ('p1', 'Aditya')`),
    db.prepare(`INSERT INTO "PlaidItem" ("id", "itemId", "accessToken") VALUES (1, 'old', 's'), (2, 'new', 's')`),
  ])
  await db.batch([upsertAccounts(db, 1, [acct('old-acc')], 'now'), upsertAccounts(db, 2, [acct('new-acc')], 'now')])
})

describe('move splits to a new link', () => {
  it('moves each split and user category to the same charge on the new link', async () => {
    await db.batch([
      upsertTransactions(db, [tx('o1', 'old-acc'), tx('o2', 'old-acc', { date: '2026-10-11', amount: 50 })], 'now'),
      upsertTransactions(db, [tx('n1', 'new-acc'), tx('n2', 'new-acc', { date: '2026-10-11', amount: 50 }), tx('n3', 'new-acc', { date: '2026-01-05' })], 'now'),
    ])
    await splitOn('o1', 'e1')
    await db.prepare(`UPDATE "Transaction" SET "userCategory" = 'TRAVEL' WHERE "plaidTransactionId" = 'o2'`).run()

    const found = await matches()
    expect(found.map(problem)).toEqual([null, null])
    await db.batch(applySql(found).map((s) => db.prepare(s)))

    expect(await splitTargets()).toEqual([{ id: 'e1', plaidTransactionId: 'n1' }])
    expect(await rows(`SELECT "plaidTransactionId", "userCategory" FROM "Transaction" WHERE "userCategory" IS NOT NULL ORDER BY 1`))
      .toEqual([{ plaidTransactionId: 'n2', userCategory: 'TRAVEL' }, { plaidTransactionId: 'o2', userCategory: 'TRAVEL' }])
    expect(await rows(leftoverSql(1))).toEqual([{ left: 0 }])
  })

  it('flags a charge with no match, two matches, or a match that already has a split', async () => {
    await db.batch([
      upsertTransactions(db, [
        tx('o1', 'old-acc'),
        tx('o2', 'old-acc', { amount: 20 }),
        tx('o3', 'old-acc', { amount: 30 }),
      ], 'now'),
      upsertTransactions(db, [
        tx('n2a', 'new-acc', { amount: 20 }),
        tx('n2b', 'new-acc', { amount: 20 }),
        tx('n3', 'new-acc', { amount: 30 }),
      ], 'now'),
    ])
    await splitOn('o1', 'e1')
    await splitOn('o2', 'e2')
    await splitOn('o3', 'e3')
    await splitOn('n3', 'e4')

    expect((await matches()).map(problem)).toEqual([
      'no match on the new link',
      '2 matches on the new link',
      'the match already has a split',
    ])
  })

  it('does not match a pending charge or a different card', async () => {
    await upsertAccounts(db, 2, [{ ...acct('other-acc'), mask: '2001' }], 'now').run()
    await db.batch([
      upsertTransactions(db, [tx('o1', 'old-acc')], 'now'),
      upsertTransactions(db, [tx('n1', 'new-acc', { pending: true }), tx('n2', 'other-acc')], 'now'),
    ])
    await splitOn('o1', 'e1')

    expect((await matches()).map(problem)).toEqual(['no match on the new link'])
  })
})
