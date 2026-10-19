import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { getDb } from '../db'
import { isPlaidConfigured } from '../plaid'

export const accounts = new Hono<AppEnv>()

// GET /api/accounts — linked banks and their accounts. Leaves out access
// tokens and sync cursors, which must never reach the browser.
accounts.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const items = await db.query.plaidItem.findMany({
    orderBy: (i, { asc }) => [asc(i.createdAt)],
    columns: { id: true, institutionName: true, institutionLogo: true, institutionColor: true },
    with: {
      accounts: {
        orderBy: (a, { asc }) => [asc(a.name)],
        columns: { id: true, name: true, mask: true, type: true, subtype: true, currentBalance: true, updatedAt: true },
      },
    },
  })
  return c.json({ plaidConfigured: isPlaidConfigured(), items })
})
