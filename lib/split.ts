import { apportion, Cents } from '@/lib/money'

export interface PersonShare { personId: string; cents: Cents }
export interface SplitItem { id: string; lineTotalCents: Cents; assigneeIds: string[] }
export interface ItemizedInput { items: SplitItem[]; taxCents: Cents }
export interface ItemizedResult {
  perPerson: PersonShare[]
  perItem: { itemId: string; effectiveCents: Cents }[]
  totalCents: Cents
}

function gcd(a: number, b: number): number { while (b) { [a, b] = [b, a % b] } return a }
function lcm(a: number, b: number): number { return (a / gcd(a, b)) * b }

export function splitItemized(input: ItemizedInput): ItemizedResult {
  const { items, taxCents } = input
  if (items.length === 0) throw new Error('splitItemized: no items')
  for (const it of items) {
    if (it.assigneeIds.length === 0) throw new Error(`splitItemized: item ${it.id} has no assignees`)
  }
  // 1. Prorate tax across items by line-total share; each item's effective (tax-inclusive) cost.
  const taxParts = apportion(taxCents, items.map(i => i.lineTotalCents))
  const perItem = items.map((it, idx) => ({ itemId: it.id, effectiveCents: it.lineTotalCents + taxParts[idx] }))
  const totalCents = perItem.reduce((a, b) => a + b.effectiveCents, 0)
  // 2. Each person's EXACT fractional share across the whole receipt, kept integer by
  //    scaling with D = lcm of assignee counts (scaled value is the numerator over D).
  const D = items.reduce((acc, it) => lcm(acc, it.assigneeIds.length), 1)
  const scaled = new Map<string, number>()
  items.forEach((it, idx) => {
    const perAssignee = perItem[idx].effectiveCents * (D / it.assigneeIds.length) // integer
    for (const pid of it.assigneeIds) scaled.set(pid, (scaled.get(pid) ?? 0) + perAssignee)
  })
  // 3. One largest-remainder reconciliation at the PERSON level => fairest split that
  //    sums exactly to totalCents; deterministic tie-break by sorted personId.
  const persons = [...scaled.keys()].sort()
  const floors = persons.map(p => Math.floor(scaled.get(p)! / D))
  const leftover = totalCents - floors.reduce((a, b) => a + b, 0)
  const order = persons
    .map((p, i) => ({ i, rem: scaled.get(p)! % D }))
    .sort((a, b) => (b.rem - a.rem) || (a.i - b.i))
  const cents = floors.slice()
  for (let k = 0; k < leftover; k++) cents[order[k].i] += 1
  const perPerson = persons.map((personId, i) => ({ personId, cents: cents[i] }))
  return { perPerson, perItem, totalCents }
}

export function splitSimpleEven(totalCents: Cents, participantIds: string[]): PersonShare[] {
  if (participantIds.length === 0) throw new Error('splitSimpleEven: no participants')
  const parts = apportion(totalCents, participantIds.map(() => 1))
  return participantIds.map((personId, i) => ({ personId, cents: parts[i] }))
}

export function splitSimpleExact(totalCents: Cents, shares: PersonShare[]): PersonShare[] {
  const s = shares.reduce((a, b) => a + b.cents, 0)
  if (s !== totalCents) throw new Error('exact split must sum to total')
  return shares
}
