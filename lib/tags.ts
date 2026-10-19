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

/** Names that aren't in the tag list. Tags are created on the Tags page, not on expenses. */
export function unknownTags(names: string[], existing: string[]): string[] {
  const found = new Set(existing)
  return names.filter(n => !found.has(n))
}
