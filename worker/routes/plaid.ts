import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { getDb } from '../db'
import { account, plaidItem } from '../db/schema'
import { readJson } from '../http'
import { PlaidConfigError, plaid, plaidRedirectUri } from '../plaid'
import { accountFields, syncAllItems, syncItem } from '../sync'

export const plaidRoutes = new Hono<AppEnv>()

/** 503 for missing Plaid keys, otherwise a 500 with a safe message. */
function plaidFailure(error: unknown, label: string, message: string) {
  if (error instanceof PlaidConfigError) return Response.json({ error: error.message }, { status: 503 })
  console.error(`[plaid] ${label} failed`, error)
  return Response.json({ error: message }, { status: 500 })
}

plaidRoutes.post('/link-token', async (c) => {
  try {
    const { link_token } = await plaid.linkTokenCreate(plaidRedirectUri())
    return c.json({ link_token })
  } catch (error) {
    return plaidFailure(error, 'linkTokenCreate', 'Failed to create link token')
  }
})

plaidRoutes.post('/exchange', async (c) => {
  const db = getDb(c.env.DB)
  const body = await readJson(c)
  if (body instanceof Response) return body
  const publicToken = (body as { public_token?: string } | null)?.public_token
  if (!publicToken) return c.json({ error: 'Missing public_token' }, 400)

  try {
    const exchange = await plaid.publicTokenExchange(publicToken)
    const accessToken = exchange.access_token

    const itemInfo = await plaid.itemGet(accessToken)
    const institutionId = itemInfo.item.institution_id ?? null

    let institutionName: string | null = null
    let institutionLogo: string | null = null
    let institutionColor: string | null = null
    if (institutionId) {
      const { institution } = await plaid.institutionGetById(institutionId)
      institutionName = institution.name
      institutionLogo = institution.logo ?? null
      institutionColor = institution.primary_color ?? null
    }

    const { accounts } = await plaid.accountsGet(accessToken)

    const [created] = await db
      .insert(plaidItem)
      .values({ itemId: exchange.item_id, accessToken, institutionId, institutionName, institutionLogo, institutionColor })
      .returning({ id: plaidItem.id, institutionName: plaidItem.institutionName })
    if (accounts.length > 0) {
      await db
        .insert(account)
        .values(accounts.map((acct) => ({ plaidAccountId: acct.account_id, itemId: created.id, ...accountFields(acct) })))
    }

    return c.json({ id: created.id, institution_name: created.institutionName, account_count: accounts.length })
  } catch (error) {
    return plaidFailure(error, 'exchange', 'Failed to exchange public token')
  }
})

plaidRoutes.post('/sync', async (c) => {
  try {
    return c.json({ results: await syncAllItems(getDb(c.env.DB)) })
  } catch (error) {
    return plaidFailure(error, 'sync all', 'Sync failed')
  }
})

plaidRoutes.post('/sync/:itemId', async (c) => {
  const id = Number(c.req.param('itemId'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid item id' }, 400)
  try {
    return c.json({ results: [await syncItem(getDb(c.env.DB), id)] })
  } catch (error) {
    return plaidFailure(error, `sync item ${id}`, 'Sync failed')
  }
})

// Unlink a bank at Plaid and drop its accounts and transactions. Splits made
// from them stay, unlinked.
plaidRoutes.delete('/items/:itemId', async (c) => {
  const db = getDb(c.env.DB)
  const id = Number(c.req.param('itemId'))
  if (!Number.isInteger(id)) return c.json({ error: 'Invalid item id' }, 400)

  const item = await db.query.plaidItem.findFirst({ where: (i, { eq }) => eq(i.id, id) })
  if (!item) return c.json({ error: 'Bank not found' }, 404)

  try {
    await plaid.itemRemove(item.accessToken)
  } catch (error) {
    if (error instanceof PlaidConfigError) return c.json({ error: error.message }, 503)
    console.error(`[plaid] itemRemove ${id} failed`, error)
  }

  await db.delete(plaidItem).where(eq(plaidItem.id, id))
  return c.json({ ok: true })
})
