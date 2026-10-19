import { cache } from 'react'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

/** The D1 database binding named DB in wrangler.jsonc. */
export function getD1(): D1Database {
  return getCloudflareContext().env.DB
}

/**
 * A Prisma client for the current request. A Worker can't reuse a client
 * across requests, so each request makes its own (shared within it).
 *
 * D1 has no transactions: Prisma runs `$transaction` steps one by one with
 * no rollback. Writes that must be all-or-nothing go through `getD1().batch`.
 */
export const getDb = cache(() => new PrismaClient({ adapter: new PrismaD1(getD1()) }))
