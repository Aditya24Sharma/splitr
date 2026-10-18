import { describe, it, expect } from 'vitest'
import { normalizeTag, parseTags, unknownTags } from '@/lib/tags'
import type { PrismaClient } from '@prisma/client'

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
  // Stands in for the database: only "walmart" and "costco" exist
  const db = {
    tag: {
      findMany: async ({ where }: { where: { name: { in: string[] } } }) =>
        ['walmart', 'costco'].filter(n => where.name.in.includes(n)).map(name => ({ name })),
    },
  } as unknown as Pick<PrismaClient, 'tag'>

  it('returns names missing from the tag list', async () => {
    expect(await unknownTags(db, ['walmart', 'trip to x'])).toEqual(['trip to x'])
  })

  it('returns nothing when every tag exists, or none are given', async () => {
    expect(await unknownTags(db, ['costco', 'walmart'])).toEqual([])
    expect(await unknownTags(db, [])).toEqual([])
  })
})
