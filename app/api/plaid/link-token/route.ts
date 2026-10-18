import { NextResponse } from 'next/server'
import {
  PLAID_USER_ID,
  PlaidConfigError,
  getPlaid,
  plaidCountryCodes,
  plaidProducts,
  plaidRedirectUri,
} from '@/lib/plaid'

export async function POST() {
  try {
    const redirectUri = plaidRedirectUri()
    const response = await getPlaid().linkTokenCreate({
      client_name: 'Splitr',
      language: 'en',
      user: { client_user_id: PLAID_USER_ID },
      products: plaidProducts(),
      country_codes: plaidCountryCodes(),
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    })
    return NextResponse.json({ link_token: response.data.link_token })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[plaid] linkTokenCreate failed', error)
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 })
  }
}
