import { NextResponse } from 'next/server'
import { PlaidConfigError, plaid, plaidRedirectUri } from '@/lib/plaid'

export async function POST() {
  try {
    const { link_token } = await plaid.linkTokenCreate(plaidRedirectUri())
    return NextResponse.json({ link_token })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[plaid] linkTokenCreate failed', error)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
