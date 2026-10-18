import type { Context } from 'hono'

/** The request's JSON body, or a 400 response to return if it isn't JSON. */
export async function readJson(c: Context): Promise<unknown | Response> {
  try {
    return await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
}

/** D1's message for a UNIQUE constraint failure, the way Prisma's P2002 was. */
export function isUniqueViolation(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? '')}` : ''
  return msg.includes('UNIQUE constraint failed')
}
