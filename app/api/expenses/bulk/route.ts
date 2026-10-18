import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseBulkAction } from '@/lib/bulk'
import { unknownTags } from '@/lib/tags'

// ---------------------------------------------------------------------------
// POST /api/expenses/bulk  — apply one action to several expenses at once:
//   { ids, action: 'add-tag' | 'remove-tag', tag }
//   { ids, action: 'set-logged', logged }
//   { ids, action: 'delete' }
// All-or-nothing: if any id is missing, nothing changes.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBulkAction(body)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { ids, op } = parsed

  if ((op.action === 'add-tag' || op.action === 'remove-tag') && (await unknownTags(prisma, [op.tag])).length > 0) {
    return NextResponse.json({ error: `unknown tag: ${op.tag}` }, { status: 400 })
  }

  const found = await prisma.expense.count({ where: { id: { in: ids } } })
  if (found !== ids.length) {
    return NextResponse.json({ error: 'Some expenses were not found' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    if (op.action === 'set-logged') {
      await tx.expense.updateMany({ where: { id: { in: ids } }, data: { loggedToSplitwise: op.logged } })
    } else if (op.action === 'delete') {
      await tx.expense.deleteMany({ where: { id: { in: ids } } }) // items and participants cascade
    } else {
      const tags = op.action === 'add-tag' ? { connect: { name: op.tag } } : { disconnect: { name: op.tag } }
      for (const id of ids) {
        await tx.expense.update({ where: { id }, data: { tags } })
      }
    }
  })

  return NextResponse.json({ updated: ids.length })
}
