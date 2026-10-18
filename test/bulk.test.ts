import { describe, it, expect } from 'vitest'
import { parseBulkAction } from '@/lib/bulk'

describe('parseBulkAction', () => {
  it('accepts each action and de-duplicates ids', () => {
    expect(parseBulkAction({ ids: ['a', 'b', 'a'], action: 'add-tag', tag: ' Walmart ' })).toEqual({
      ids: ['a', 'b'],
      op: { action: 'add-tag', tag: 'walmart' },
    })
    expect(parseBulkAction({ ids: ['a'], action: 'remove-tag', tag: 'costco' })).toEqual({
      ids: ['a'],
      op: { action: 'remove-tag', tag: 'costco' },
    })
    expect(parseBulkAction({ ids: ['a'], action: 'set-logged', logged: false })).toEqual({
      ids: ['a'],
      op: { action: 'set-logged', logged: false },
    })
    expect(parseBulkAction({ ids: ['a'], action: 'delete' })).toEqual({ ids: ['a'], op: { action: 'delete' } })
  })

  it('rejects missing or empty ids', () => {
    expect(parseBulkAction({ action: 'delete' })).toHaveProperty('error')
    expect(parseBulkAction({ ids: [], action: 'delete' })).toHaveProperty('error')
    expect(parseBulkAction({ ids: [1], action: 'delete' })).toHaveProperty('error')
    expect(parseBulkAction(null)).toHaveProperty('error')
  })

  it('rejects bad options and unknown actions', () => {
    expect(parseBulkAction({ ids: ['a'], action: 'add-tag', tag: '  ' })).toEqual({ error: 'tag is required' })
    expect(parseBulkAction({ ids: ['a'], action: 'set-logged', logged: 'yes' })).toEqual({ error: 'logged must be a boolean' })
    expect(parseBulkAction({ ids: ['a'], action: 'archive' })).toHaveProperty('error')
  })
})
