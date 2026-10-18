import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { TX_INCLUDE, txView } from '@/lib/transactions'
import { parseManualTx } from '@/lib/manual-tx'

// ---------------------------------------------------------------------------
// GET /api/transactions — every transaction, newest first
// ---------------------------------------------------------------------------
export async function GET() {
  const rows = await prisma.transaction.findMany({
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    include: TX_INCLUDE,
  })
  return NextResponse.json(rows.map(txView))
}

// ---------------------------------------------------------------------------
// POST /api/transactions — add an expense by hand (cash, Venmo, etc.)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseManualTx(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const tx = await prisma.transaction.create({
    data: { source: 'MANUAL', ...parsed.fields },
    include: TX_INCLUDE,
  })
  return NextResponse.json(txView(tx), { status: 201 })
}
