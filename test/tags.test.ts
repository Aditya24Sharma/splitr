import { describe, it, expect } from 'vitest'
import { normalizeTag, parseTags, unknownTags } from '@/lib/tags'

describe('normalizeTag', () => {
  it('trims, lowercases, and collapses spaces', () => {
    expect(normalizeTag('  Trip   to X ')).toBe('trip to x')
  })
})

describe('parseTags', () => {
  it('cleans and de-duplicates names', () => {
    expect(parseTags(['Walmart', 'walmart ', 'Trip to X'])).toEqual(['walmart', 'trip to x'])
  })

  it('drops blank names', () => {
    expect(parseTags(['', '   ', 'costco'])).toEqual(['costco'])
  })

  it('rejects values that are not string arrays', () => {
    expect(parseTags('walmart')).toBeNull()
    expect(parseTags([1, 2])).toBeNull()
    expect(parseTags(undefined)).toBeNull()
  })
})

describe('unknownTags', () => {
  // Only "walmart" and "costco" exist
  const existing = ['walmart', 'costco']

  it('returns names missing from the tag list', () => {
    expect(unknownTags(['walmart', 'trip to x'], existing)).toEqual(['trip to x'])
  })

  it('returns nothing when every tag exists, or none are given', () => {
    expect(unknownTags(['costco', 'walmart'], existing)).toEqual([])
    expect(unknownTags([], existing)).toEqual([])
  })
})
