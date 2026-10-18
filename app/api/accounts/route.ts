import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isPlaidConfigured } from '@/lib/plaid'

// ---------------------------------------------------------------------------
// GET /api/accounts — linked banks and their accounts. Leaves out access
// tokens and sync cursors, which must never reach the browser.
// ---------------------------------------------------------------------------
export async function GET() {
  const items = await prisma.plaidItem.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      institutionName: true,
      institutionLogo: true,
      institutionColor: true,
      accounts: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          mask: true,
          type: true,
          subtype: true,
          currentBalance: true,
          updatedAt: true,
        },
      },
    },
  })
  return NextResponse.json({ plaidConfigured: isPlaidConfigured(), items })
}
