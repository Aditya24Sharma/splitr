import { expenseFields, type ExpenseInput } from '@/lib/expense-input'

// Writes a split and its items/people/tags as one D1 batch. A batch is
// all-or-nothing, which Prisma can't offer on D1 (its transactions run step by
// step). A half-written split, say one with no people, would make its
// breakdown throw and break every page that lists it.

/** DateTime columns hold ISO strings, the same text Prisma writes. */
function dbValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 1 : 0
  return v ?? null
}

function insert(db: D1Database, table: string, row: Record<string, unknown>): D1PreparedStatement {
  const cols = Object.keys(row)
  return db
    .prepare(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(...cols.map(c => dbValue(row[c])))
}

/** Items + assignments (receipts) or participants (quick splits), plus tag links. */
function childStatements(db: D1Database, expenseId: string, input: ExpenseInput, tagIds: string[]) {
  const stmts: D1PreparedStatement[] = []
  if (input.type === 'ITEMIZED') {
    input.items.forEach((it, idx) => {
      const itemId = crypto.randomUUID()
      stmts.push(
        insert(db, 'Item', {
          id: itemId,
          expenseId,
          name: it.name,
          rawName: it.rawName ?? null,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          lineTotalCents: it.lineTotalCents,
          sortOrder: idx,
        }),
      )
      for (const personId of it.assigneeIds) stmts.push(insert(db, 'ItemAssignment', { itemId, personId }))
    })
  } else {
    for (const p of input.participants) {
      stmts.push(insert(db, 'ExpenseParticipant', { expenseId, personId: p.personId, exactAmountCents: p.exactAmountCents }))
    }
  }
  // Prisma's implicit many-to-many table: A = Expense.id, B = Tag.id
  for (const tagId of tagIds) stmts.push(insert(db, '_ExpenseToTag', { A: expenseId, B: tagId }))
  return stmts
}

/** Creates a split; returns its id. */
export async function createExpense(
  db: D1Database,
  input: ExpenseInput,
  tagIds: string[],
  transactionId?: number,
): Promise<string> {
  const id = crypto.randomUUID()
  await db.batch([
    insert(db, 'Expense', {
      id,
      ...expenseFields(input),
      createdAt: new Date(),
      ...(transactionId !== undefined && { transactionId }),
    }),
    ...childStatements(db, id, input, tagIds),
  ])
  return id
}

/**
 * Replaces a split's fields, items, people, and tags. Clears
 * loggedToSplitwise so the edit gets re-entered in Splitwise. Its date
 * entered and linked charge stay as they were.
 */
export async function replaceExpense(db: D1Database, id: string, input: ExpenseInput, tagIds: string[]) {
  const fields: Record<string, unknown> = { ...expenseFields(input), loggedToSplitwise: false }
  const cols = Object.keys(fields)
  await db.batch([
    db.prepare('DELETE FROM "Item" WHERE "expenseId" = ?').bind(id), // assignments cascade
    db.prepare('DELETE FROM "ExpenseParticipant" WHERE "expenseId" = ?').bind(id),
    db.prepare('DELETE FROM "_ExpenseToTag" WHERE "A" = ?').bind(id),
    db
      .prepare(`UPDATE "Expense" SET ${cols.map(c => `"${c}" = ?`).join(', ')} WHERE "id" = ?`)
      .bind(...cols.map(c => dbValue(fields[c])), id),
    ...childStatements(db, id, input, tagIds),
  ])
}
