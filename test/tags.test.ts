import { describe, it, expect } from 'vitest'
import { normalizeTag, parseTags } from '@/lib/tags'

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
