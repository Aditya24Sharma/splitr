// One-time copy of linked banks, accounts, transactions, and balance history
// from the old Finance Tracker database into Splitr's database. The Plaid
// access tokens are copied as-is, so the bank connections keep working
// without re-linking. The source database is opened read-only.
//
//   node scripts/import-finance.mjs ../Finance_tracker/data/finance.db

import Database from 'better-sqlite3'

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('usage: node scripts/import-finance.mjs <path to finance.db>')
  process.exit(1)
}
const targetPath = (process.env.DATABASE_URL ?? 'file:./prisma/dev.db').replace(/^file:/, '')

const src = new Database(sourcePath, { readonly: true, fileMustExist: true })
const dst = new Database(targetPath, { fileMustExist: true })
dst.pragma('foreign_keys = ON')

const already = dst.prepare('SELECT count(*) AS n FROM PlaidItem').get().n
if (already > 0) {
  console.error(`Splitr already has ${already} linked bank(s); refusing to import twice.`)
  process.exit(1)
}

// Drizzle stored unix seconds; Prisma stores ISO strings
const iso = (secs) => new Date((secs ?? Date.now() / 1000) * 1000).toISOString()

const counts = dst.transaction(() => {
  const items = src.prepare('SELECT * FROM plaid_items').all()
  const insItem = dst.prepare(`INSERT INTO PlaidItem
    (id, itemId, accessToken, institutionId, institutionName, institutionLogo, institutionColor, cursor, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const r of items) {
    insItem.run(r.id, r.item_id, r.access_token, r.institution_id, r.institution_name,
      r.institution_logo, r.institution_color, r.cursor, iso(r.created_at))
  }

  const accounts = src.prepare('SELECT * FROM accounts').all()
  const insAccount = dst.prepare(`INSERT INTO Account
    (id, plaidAccountId, itemId, name, officialName, mask, type, subtype, currentBalance, availableBalance, isoCurrencyCode, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  for (const r of accounts) {
    insAccount.run(r.id, r.plaid_account_id, r.item_id, r.name, r.official_name, r.mask, r.type,
      r.subtype, r.current_balance, r.available_balance, r.iso_currency_code ?? 'USD', iso(r.updated_at))
  }

  const txs = src.prepare('SELECT * FROM transactions').all()
  const insTx = dst.prepare(`INSERT INTO "Transaction"
    (id, source, plaidTransactionId, accountId, date, amount, name, merchantName, categoryPrimary, categoryDetailed, pending, isoCurrencyCode, createdAt)
    VALUES (?, 'PLAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const now = iso()
  for (const r of txs) {
    insTx.run(r.id, r.plaid_transaction_id, r.account_id, r.date, r.amount, r.name, r.merchant_name,
      r.category_primary, r.category_detailed, r.pending ? 1 : 0, r.iso_currency_code ?? 'USD', now)
  }

  const snaps = src.prepare('SELECT * FROM balance_snapshots').all()
  const insSnap = dst.prepare(`INSERT INTO BalanceSnapshot
    (id, accountId, date, currentBalance, availableBalance) VALUES (?, ?, ?, ?, ?)`)
  for (const r of snaps) {
    insSnap.run(r.id, r.account_id, r.date, r.current_balance, r.available_balance)
  }

  return { banks: items.length, accounts: accounts.length, transactions: txs.length, snapshots: snaps.length }
})()

console.log('Imported', counts)
