import { describe, it, expect } from 'vitest'
import { groupSelection, isGroupPicked, parseGroupInput } from '@/lib/groups'

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

describe('groupSelection', () => {
  const active = new Set(['me', 'A', 'B', 'C'])

  it('picks the members plus you, skipping archived people', () => {
    expect(groupSelection(['A', 'B', 'gone'], active, 'me')).toEqual(new Set(['A', 'B', 'me']))
  })

  it('works before you have marked yourself', () => {
    expect(groupSelection(['A'], active, undefined)).toEqual(new Set(['A']))
  })

  it('knows when exactly that group is picked', () => {
    expect(isGroupPicked(['A', 'B'], active, 'me', new Set(['me', 'A', 'B']))).toBe(true)
    expect(isGroupPicked(['A', 'B'], active, 'me', new Set(['me', 'A', 'B', 'C']))).toBe(false)
    expect(isGroupPicked(['A', 'B'], active, 'me', new Set(['me', 'A']))).toBe(false)
  })
})
