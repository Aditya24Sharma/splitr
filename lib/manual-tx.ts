// Validation for an expense added by hand. Shared by create and edit.

export interface ManualTxFields {
  name: string
  amount: number
  date: string
  categoryPrimary: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw JSON body, checked field by field below
export function parseManualTx(body: any): { fields: ManualTxFields } | { error: string } {
  const { name, amountCents, date, categoryPrimary } = body ?? {}
  if (typeof name !== 'string' || !name.trim()) return { error: 'name is required' }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { error: 'amountCents must be a positive whole number of cents' }
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'date must look like 2026-10-18' }
  }
  if (typeof categoryPrimary !== 'string' || !categoryPrimary) return { error: 'categoryPrimary is required' }
  // Stored with Plaid's sign: positive = money out
  return { fields: { name: name.trim(), amount: amountCents, date, categoryPrimary } }
}
