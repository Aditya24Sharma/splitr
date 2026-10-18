import { NextResponse } from 'next/server'
import { PlaidConfigError } from '@/lib/plaid'
import { syncAllItems } from '@/lib/sync'

export async function POST() {
  try {
    return NextResponse.json({ results: await syncAllItems() })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[plaid] sync all failed', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
