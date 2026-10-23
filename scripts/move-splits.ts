// Moves splits and re-categorized charges from an old link of a bank to a new
// link of the same bank, so the old one can be unlinked without losing them.
// A charge on the new link matches when it has the same card mask, date, and
// amount. Nothing changes unless every charge has exactly one match.
//
//   node scripts/move-splits.ts --list [--remote]
//   node scripts/move-splits.ts --old <id> --new <id> [--remote] [--apply]
//
// Without --remote it uses the local database. Without --apply it only prints.

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export type Match = {
  oldId: number
  date: string
  amount: number
  name: string
  mask: string | null
  userCategory: string | null
  expenseId: string | null
  candidates: number
  newId: number | null
  newHasSplit: number
}

export const listSql = `
  SELECT p."id", p."institutionName", p."createdAt",
    (SELECT COUNT(*) FROM "Account" a WHERE a."itemId" = p."id") AS "accounts",
    (SELECT MIN(t."date") FROM "Transaction" t JOIN "Account" a ON a."id" = t."accountId" WHERE a."itemId" = p."id") AS "oldest"
  FROM "PlaidItem" p ORDER BY p."id"`

/** Every charge on the old link with a split or a user category, and its matches on the new link. */
export function matchesSql(oldItem: number, newItem: number) {
  return `
  WITH moving AS (
    SELECT t."id", t."date", t."amount", t."name", t."userCategory", a."mask"
    FROM "Transaction" t JOIN "Account" a ON a."id" = t."accountId"
    WHERE a."itemId" = ${int(oldItem)}
      AND (t."userCategory" IS NOT NULL OR EXISTS (SELECT 1 FROM "Expense" e WHERE e."transactionId" = t."id"))
  ),
  candidates AS (
    SELECT m."id" AS "oldId", n."id" AS "newId"
    FROM moving m
    JOIN "Account" na ON na."itemId" = ${int(newItem)} AND na."mask" = m."mask"
    JOIN "Transaction" n ON n."accountId" = na."id" AND n."date" = m."date" AND n."amount" = m."amount" AND n."pending" = 0
  )
  SELECT m."id" AS "oldId", m."date", m."amount", m."name", m."mask", m."userCategory",
    (SELECT e."id" FROM "Expense" e WHERE e."transactionId" = m."id") AS "expenseId",
    (SELECT COUNT(*) FROM candidates c WHERE c."oldId" = m."id") AS "candidates",
    (SELECT MIN(c."newId") FROM candidates c WHERE c."oldId" = m."id") AS "newId",
    EXISTS (SELECT 1 FROM candidates c JOIN "Expense" e ON e."transactionId" = c."newId" WHERE c."oldId" = m."id") AS "newHasSplit"
  FROM moving m ORDER BY m."date", m."id"`
}

/** Why a match can't be moved, or null when it can. */
export function problem(m: Match): string | null {
  if (m.candidates === 0) return 'no match on the new link'
  if (m.candidates > 1) return `${m.candidates} matches on the new link`
  if (m.newHasSplit) return 'the match already has a split'
  return null
}

/** Points each split at its match and copies each user category over. */
export function applySql(matches: Match[]) {
  const pairs = `'${JSON.stringify(matches.map((m) => ({ old: int(m.oldId), new: int(m.newId!) })))}'`
  return [
    `UPDATE "Expense" SET "transactionId" = (
      SELECT j.value ->> 'new' FROM json_each(${pairs}) j WHERE j.value ->> 'old' = "Expense"."transactionId")
    WHERE "transactionId" IN (SELECT j.value ->> 'old' FROM json_each(${pairs}) j)`,
    `UPDATE "Transaction" SET "userCategory" = (
      SELECT o."userCategory" FROM json_each(${pairs}) j JOIN "Transaction" o ON o."id" = j.value ->> 'old'
      WHERE j.value ->> 'new' = "Transaction"."id")
    WHERE "id" IN (SELECT j.value ->> 'new' FROM json_each(${pairs}) j
      JOIN "Transaction" o ON o."id" = j.value ->> 'old' WHERE o."userCategory" IS NOT NULL)`,
  ]
}

/** Splits still on the old link. Zero after a successful move. */
export function leftoverSql(oldItem: number) {
  return `
  SELECT COUNT(*) AS "left" FROM "Expense" e
  JOIN "Transaction" t ON t."id" = e."transactionId" JOIN "Account" a ON a."id" = t."accountId"
  WHERE a."itemId" = ${int(oldItem)}`
}

function int(n: number) {
  if (!Number.isInteger(n)) throw new Error(`Not an id: ${n}`)
  return n
}

function query<T>(sql: string, remote: boolean): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'splitr', remote ? '--remote' : '--local', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  const results = JSON.parse(out) as { results: T[] }[]
  return results.flatMap((r) => r.results)
}

function main() {
  const { values } = parseArgs({
    options: {
      list: { type: 'boolean' },
      old: { type: 'string' },
      new: { type: 'string' },
      remote: { type: 'boolean' },
      apply: { type: 'boolean' },
    },
  })
  const remote = values.remote ?? false
  console.log(`Database: ${remote ? 'LIVE (remote)' : 'local'}\n`)

  if (values.list) {
    console.table(query(listSql, remote))
    return
  }

  const oldItem = Number(values.old)
  const newItem = Number(values.new)
  if (!values.old || !values.new || oldItem === newItem) {
    console.error('Usage: node scripts/move-splits.ts --old <id> --new <id> [--remote] [--apply]')
    process.exit(1)
  }

  const matches = query<Match>(matchesSql(oldItem, newItem), remote)
  console.table(
    matches.map((m) => ({
      date: m.date,
      amount: (m.amount / 100).toFixed(2),
      name: m.name,
      card: m.mask,
      split: m.expenseId ? 'yes' : '',
      category: m.userCategory ?? '',
      from: m.oldId,
      to: m.newId,
      problem: problem(m) ?? '',
    })),
  )
  const bad = matches.filter((m) => problem(m))
  const splits = matches.filter((m) => m.expenseId).length
  console.log(`${matches.length} charges (${splits} splits), ${bad.length} with a problem.`)

  if (bad.length > 0) {
    console.log('Nothing changed.')
    process.exit(1)
  }
  if (!values.apply) {
    console.log('Dry run. Nothing changed. Add --apply to move them.')
    return
  }

  query(applySql(matches).join(';\n'), remote)
  const [{ left }] = query<{ left: number }>(leftoverSql(oldItem), remote)
  console.log(`Moved. Splits left on the old link: ${left}.`)
  if (left > 0) process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
