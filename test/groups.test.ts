import { describe, it, expect } from 'vitest'
import { parseGroupInput } from '@/lib/groups'

describe('parseGroupInput', () => {
  it('trims the name and drops repeated people', () => {
    expect(parseGroupInput({ name: '  Tahoe trip ', memberIds: ['A', 'B', 'A'] })).toEqual({
      input: { name: 'Tahoe trip', memberIds: ['A', 'B'] },
    })
  })

  it('rejects a blank name', () => {
    expect(parseGroupInput({ name: ' ', memberIds: ['A'] })).toEqual({ error: 'Give the group a name' })
    expect(parseGroupInput(null)).toEqual({ error: 'Give the group a name' })
  })

  it('rejects a group with nobody in it, or bad ids', () => {
    expect(parseGroupInput({ name: 'Trip', memberIds: [] })).toEqual({ error: 'Pick at least one person for the group' })
    expect(parseGroupInput({ name: 'Trip', memberIds: [1] })).toEqual({ error: 'memberIds must be an array of person ids' })
    expect(parseGroupInput({ name: 'Trip' })).toEqual({ error: 'memberIds must be an array of person ids' })
  })
})
