import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { TX_INCLUDE, txView } from '@/lib/transactions'
import { parseManualTx } from '@/lib/manual-tx'

async function findTx(rawId: string) {
  const id = Number(rawId)
  if (!Number.isInteger(id)) return null
  return prisma.transaction.findUnique({ where: { id }, include: TX_INCLUDE })
}

// ---------------------------------------------------------------------------
// GET /api/transactions/[id]
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tx = await findTx((await params).id)
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  return NextResponse.json(txView(tx))
}

// ---------------------------------------------------------------------------
// PATCH /api/transactions/[id]
// Any transaction: { categoryPrimary }. Hand-added ones: the full form body.
// Bank transactions are otherwise owned by Plaid and overwritten on sync.
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tx = await findTx((await params).id)
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let data: { userCategory?: string; categoryPrimary?: string; name?: string; amount?: number; date?: string }
  if (Object.keys(body).length === 1 && 'categoryPrimary' in body) {
    if (typeof body.categoryPrimary !== 'string' || !body.categoryPrimary) {
      return NextResponse.json({ error: 'categoryPrimary must be a string' }, { status: 400 })
    }
    data = tx.source === 'MANUAL' ? { categoryPrimary: body.categoryPrimary } : { userCategory: body.categoryPrimary }
  } else {
    if (tx.source !== 'MANUAL') {
      return NextResponse.json({ error: 'Bank transactions can only be recategorized' }, { status: 400 })
    }
    const parsed = parseManualTx(body)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    data = parsed.fields
  }

  const updated = await prisma.transaction.update({ where: { id: tx.id }, data, include: TX_INCLUDE })
  return NextResponse.json(txView(updated))
}

// ---------------------------------------------------------------------------
// DELETE /api/transactions/[id] — hand-added only; a split made from it stays
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tx = await findTx((await params).id)
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (tx.source !== 'MANUAL') {
    return NextResponse.json({ error: 'Bank transactions come from your bank and can’t be deleted' }, { status: 400 })
  }
  await prisma.transaction.delete({ where: { id: tx.id } })
  return NextResponse.json({ deleted: true })
}
