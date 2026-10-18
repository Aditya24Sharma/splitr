/** Lowercase, trim, and collapse inner spaces so "Trip  to X " and "trip to x" match. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Validates a request body's `tags` value. Returns cleaned, de-duplicated
 * names, or null if the value is not an array of strings.
 */
export function parseTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) return null
  return [...new Set(value.map(normalizeTag).filter(t => t !== ''))]
}

/** Prisma input that links an expense to these tags, creating any that don't exist. */
export function connectTags(names: string[]) {
  return names.map(name => ({ where: { name }, create: { name } }))
}
