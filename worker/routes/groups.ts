import { Hono } from 'hono'
import { and, eq, inArray } from 'drizzle-orm'
import { parseGroupInput, type GroupInput } from '@/lib/groups'
import type { AppEnv } from '../app'
import { type Db, getDb } from '../db'
import { person, personGroup, personGroupMember } from '../db/schema'
import { readJson } from '../http'

export const groups = new Hono<AppEnv>()

/** An error message if any member isn't a current (unarchived) person. */
async function unknownMembers(db: Db, input: GroupInput): Promise<string | null> {
  const found = await db
    .select({ id: person.id })
    .from(person)
    .where(and(inArray(person.id, input.memberIds), eq(person.archived, false)))
  return found.length === input.memberIds.length ? null : 'Some of those people no longer exist'
}

function memberRows(groupId: string, input: GroupInput) {
  return input.memberIds.map((personId) => ({ groupId, personId }))
}

// GET /api/groups — every group with its member ids, sorted by name
groups.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db.query.personGroup.findMany({
    orderBy: (g, { asc }) => [asc(g.name)],
    with: { members: true },
  })
  return c.json(rows.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.personId) })))
})

// POST /api/groups — { name, memberIds }
groups.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await readJson(c)
  if (body instanceof Response) return body
  const parsed = parseGroupInput(body)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const { input } = parsed
  const bad = await unknownMembers(db, input)
  if (bad) return c.json({ error: bad }, 400)

  const id = crypto.randomUUID()
  await db.batch([
    db.insert(personGroup).values({ id, name: input.name }),
    db.insert(personGroupMember).values(memberRows(id, input)),
  ])
  return c.json({ id, ...input }, 201)
})

// PUT /api/groups/:id — replace the name and members
groups.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await readJson(c)
  if (body instanceof Response) return body
  const parsed = parseGroupInput(body)
  if ('error' in parsed) return c.json({ error: parsed.error }, 400)
  const { input } = parsed
  const bad = await unknownMembers(db, input)
  if (bad) return c.json({ error: bad }, 400)

  const exists = await db.query.personGroup.findFirst({ where: (g, { eq }) => eq(g.id, id), columns: { id: true } })
  if (!exists) return c.json({ error: 'Group not found' }, 404)

  await db.batch([
    db.update(personGroup).set({ name: input.name }).where(eq(personGroup.id, id)),
    db.delete(personGroupMember).where(eq(personGroupMember.groupId, id)),
    db.insert(personGroupMember).values(memberRows(id, input)),
  ])
  return c.json({ id, ...input })
})

// DELETE /api/groups/:id — the people stay; only the group goes
groups.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const deleted = await db
    .delete(personGroup)
    .where(eq(personGroup.id, c.req.param('id')))
    .returning({ id: personGroup.id })
  if (deleted.length === 0) return c.json({ error: 'Group not found' }, 404)
  return c.json({ deleted: true })
})
