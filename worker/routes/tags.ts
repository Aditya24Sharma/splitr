import { Hono } from 'hono'
import { asc, count, eq } from 'drizzle-orm'
import { normalizeTag } from '@/lib/tags'
import type { AppEnv } from '../app'
import { type Db, getDb } from '../db'
import { expenseToTag, tag } from '../db/schema'
import { isUniqueViolation, readJson } from '../http'

export const tags = new Hono<AppEnv>()

/** Tags with how many expenses use each, by name. */
function tagsWithCounts(db: Db) {
  return db
    .select({ id: tag.id, name: tag.name, expenseCount: count(expenseToTag.A) })
    .from(tag)
    .leftJoin(expenseToTag, eq(expenseToTag.B, tag.id))
    .groupBy(tag.id)
    .orderBy(asc(tag.name))
}

/** The body's tag name, cleaned; '' if missing. */
function tagName(body: unknown): string {
  const raw = (body as { name?: unknown } | null)?.name
  return typeof raw === 'string' ? normalizeTag(raw) : ''
}

// GET /api/tags  — every tag, with how many expenses use it
tags.get('/', async (c) => c.json(await tagsWithCounts(getDb(c.env.DB))))

// POST /api/tags  — { name }
tags.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await readJson(c)
  if (body instanceof Response) return body
  const name = tagName(body)
  if (!name) return c.json({ error: 'name is required' }, 400)

  try {
    const [created] = await db.insert(tag).values({ name }).returning()
    return c.json({ id: created.id, name: created.name, expenseCount: 0 }, 201)
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: `Tag "${name}" already exists` }, 409)
    throw e
  }
})

// PATCH /api/tags/:id  — rename: { name }. Expenses link to the tag, so
// every expense using it shows the new name.
tags.patch('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await readJson(c)
  if (body instanceof Response) return body
  const name = tagName(body)
  if (!name) return c.json({ error: 'name is required' }, 400)

  let renamed
  try {
    ;[renamed] = await db.update(tag).set({ name }).where(eq(tag.id, id)).returning({ id: tag.id })
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: `Tag "${name}" already exists` }, 409)
    throw e
  }
  if (!renamed) return c.json({ error: 'Tag not found' }, 404)
  const row = (await tagsWithCounts(db)).find((t) => t.id === id)!
  return c.json(row)
})

// DELETE /api/tags/:id  — the tag is removed from any expenses using it;
// the expenses themselves are kept.
tags.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const deleted = await db.delete(tag).where(eq(tag.id, c.req.param('id'))).returning({ id: tag.id })
  if (deleted.length === 0) return c.json({ error: 'Tag not found' }, 404)
  return c.json({ deleted: true })
})
