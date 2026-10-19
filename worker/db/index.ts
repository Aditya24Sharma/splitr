import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * A Drizzle client over the D1 binding. Cheap to create: no engine, no
 * connection pool, so each request makes its own.
 *
 * D1 has no transactions. Writes that must be all-or-nothing go through
 * db.batch([...]), which D1 runs as one unit.
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof getDb>
export { schema }
