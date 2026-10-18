export type Cents = number

export function toCents(dollars: number): Cents {
  return Math.round((dollars + Number.EPSILON) * 100)
}
export function toDollars(cents: Cents): number {
  return cents / 100
}
export function formatUSD(cents: Cents): string {
  const neg = cents < 0
  const v = Math.abs(cents)
  return `${neg ? '-' : ''}$${Math.floor(v / 100)}.${String(v % 100).padStart(2, '0')}`
}
export function apportion(total: Cents, weights: number[]): Cents[] {
  if (weights.length === 0) throw new Error('apportion: weights must be non-empty')
  if (total < 0) throw new Error('apportion: total must be non-negative')
  const sum = weights.reduce((a, b) => a + b, 0)
  const useEqual = sum === 0
  const effWeights = useEqual ? weights.map(() => 1) : weights
  const effSum = useEqual ? weights.length : sum
  const raw = effWeights.map(w => (total * w) / effSum)
  const floors = raw.map(Math.floor)
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  // distribute leftover cents to largest fractional remainders, tie-break by lower index
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i))
  const result = floors.slice()
  for (let k = 0; k < remainder; k++) result[order[k].i] += 1
  return result
}
