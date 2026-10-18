import { NextRequest, NextResponse } from 'next/server'
import { PlaidConfigError } from '@/lib/plaid'
import { syncItem } from '@/lib/sync'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const id = Number((await params).itemId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid item id' }, { status: 400 })

  try {
    return NextResponse.json({ results: [await syncItem(id)] })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error(`[plaid] sync item ${id} failed`, error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
