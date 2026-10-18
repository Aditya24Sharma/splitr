import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PlaidConfigError, plaid } from '@/lib/plaid'
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
    const exchange = await plaid.publicTokenExchange(publicToken)
    const accessToken = exchange.access_token

    const itemInfo = await plaid.itemGet(accessToken)
    const institutionId = itemInfo.item.institution_id ?? null

    let institutionName: string | null = null
    let institutionLogo: string | null = null
    let institutionColor: string | null = null
    if (institutionId) {
      const { institution } = await plaid.institutionGetById(institutionId)
      institutionName = institution.name
      institutionLogo = institution.logo ?? null
      institutionColor = institution.primary_color ?? null
    }

    const { accounts } = await plaid.accountsGet(accessToken)

    const item = await prisma.plaidItem.create({
      data: {
        itemId: exchange.item_id,
        accessToken,
        institutionId,
        institutionName,
        institutionLogo,
        institutionColor,
        accounts: {
          create: accounts.map(acct => ({
            plaidAccountId: acct.account_id,
            ...accountFields(acct),
          })),
        },
      },
    })

    return NextResponse.json({
      id: item.id,
      institution_name: item.institutionName,
      account_count: accounts.length,
    })
  } catch (error) {
    if (error instanceof PlaidConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('[plaid] exchange failed', error)
    return NextResponse.json({ error: 'Failed to exchange public token' }, { status: 500 })
  }
}
