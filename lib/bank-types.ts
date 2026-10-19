// Shapes returned by GET /api/accounts, for client components.

export interface BankAccount {
  id: number
  name: string
  mask: string | null
  type: string
  subtype: string | null
  currentBalance: number | null
  updatedAt: string
}

export interface BankItem {
  id: number
  institutionName: string | null
  institutionLogo: string | null
  institutionColor: string | null
  accounts: BankAccount[]
}

export interface AccountsResponse {
  plaidConfigured: boolean
  items: BankItem[]
}

export interface AccountRef {
  account: BankAccount
  item: BankItem
}

export function indexAccounts(items: BankItem[]): Map<number, AccountRef> {
  const map = new Map<number, AccountRef>()
  for (const item of items) for (const account of item.accounts) map.set(account.id, { account, item })
  return map
}

/** "Chase •• 1234" */
export function accountLabel(ref: AccountRef | undefined): string {
  if (!ref) return 'Cash'
  const bank = ref.item.institutionName ?? ref.account.name
  return ref.account.mask ? `${bank} •• ${ref.account.mask}` : bank
}

/** The most recent time any account was refreshed from the bank. */
export function lastSynced(items: BankItem[]): Date | null {
  let latest: Date | null = null
  for (const item of items) {
    for (const a of item.accounts) {
      const d = new Date(a.updatedAt)
      if (!latest || d > latest) latest = d
    }
  }
  return latest
}

export function timeAgo(d: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 45) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
