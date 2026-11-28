export interface GroupInput {
  name: string
  memberIds: string[]
}

/** Validates a group's request body. Returns the cleaned input, or an error message for a 400. */
export function parseGroupInput(body: unknown): { input: GroupInput } | { error: string } {
  const { name, memberIds } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || name.trim() === '') return { error: 'Give the group a name' }
  if (!Array.isArray(memberIds) || !memberIds.every((id) => typeof id === 'string')) {
    return { error: 'memberIds must be an array of person ids' }
  }
  const unique = [...new Set(memberIds as string[])]
  if (unique.length === 0) return { error: 'Pick at least one person for the group' }
  return { input: { name: name.trim(), memberIds: unique } }
}
