import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PlaidConfigError, plaid } from '@/lib/plaid'

// ---------------------------------------------------------------------------
// DELETE /api/plaid/items/[itemId] — unlink a bank at Plaid and drop its
// accounts and transactions. Splits made from them stay, unlinked.
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const id = Number((await params).itemId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid item id' }, { status: 400 })

  const item = await prisma.plaidItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Bank not found' }, { status: 404 })

  try {
    await plaid.itemRemove(item.accessToken)
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error(`[plaid] itemRemove ${id} failed`, error)
  }

  await prisma.plaidItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
