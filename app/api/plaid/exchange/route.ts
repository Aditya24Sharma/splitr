import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PlaidConfigError, getPlaid, plaidCountryCodes } from '@/lib/plaid'
import { accountFields } from '@/lib/sync'

export async function POST(req: NextRequest) {
  let body: { public_token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const publicToken = body.public_token
  if (!publicToken) return NextResponse.json({ error: 'Missing public_token' }, { status: 400 })

  try {
    const plaid = getPlaid()
    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken })
    const accessToken = exchange.data.access_token

    const itemInfo = await plaid.itemGet({ access_token: accessToken })
    const institutionId = itemInfo.data.item.institution_id ?? null

    let institutionName: string | null = null
    let institutionLogo: string | null = null
    let institutionColor: string | null = null
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: plaidCountryCodes(),
        options: { include_optional_metadata: true },
      })
      institutionName = inst.data.institution.name
      institutionLogo = inst.data.institution.logo ?? null
      institutionColor = inst.data.institution.primary_color ?? null
    }

    const accountsResp = await plaid.accountsGet({ access_token: accessToken })

    const item = await prisma.plaidItem.create({
      data: {
        itemId: exchange.data.item_id,
        accessToken,
        institutionId,
        institutionName,
        institutionLogo,
        institutionColor,
        accounts: {
          create: accountsResp.data.accounts.map(acct => ({
            plaidAccountId: acct.account_id,
            ...accountFields(acct),
          })),
        },
      },
    })

    return NextResponse.json({
      id: item.id,
      institution_name: item.institutionName,
      account_count: accountsResp.data.accounts.length,
    })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[plaid] exchange failed', error)
    return NextResponse.json({ error: 'Failed to exchange public token' }, { status: 500 })
  }
}
