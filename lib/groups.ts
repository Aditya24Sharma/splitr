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

/**
 * Who's in a split when you pick a group: its members who are still around,
 * plus you. Archived people may still be listed in an old group, so only ids
 * in activeIds count.
 */
export function groupSelection(memberIds: string[], activeIds: Set<string>, meId: string | undefined): Set<string> {
  const ids = new Set(memberIds.filter((id) => activeIds.has(id)))
  if (meId) ids.add(meId)
  return ids
}

/** Whether exactly this group (plus you) is what's picked. */
export function isGroupPicked(
  memberIds: string[],
  activeIds: Set<string>,
  meId: string | undefined,
  picked: Set<string>,
): boolean {
  const ids = groupSelection(memberIds, activeIds, meId)
  return ids.size === picked.size && [...ids].every((id) => picked.has(id))
}
