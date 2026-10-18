import { normalizeTag } from '@/lib/tags'

export type BulkAction =
  | { action: 'add-tag'; tag: string }
  | { action: 'remove-tag'; tag: string }
  | { action: 'set-logged'; logged: boolean }
  | { action: 'delete' }

/** Validates a POST /api/expenses/bulk body: { ids: string[], action, ...options }. */
export function parseBulkAction(body: unknown): { ids: string[]; op: BulkAction } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const ids = b.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    return { error: 'ids must be a non-empty array of expense ids' }
  }
  const unique = [...new Set(ids as string[])]

  switch (b.action) {
    case 'add-tag':
    case 'remove-tag': {
      const tag = typeof b.tag === 'string' ? normalizeTag(b.tag) : ''
      if (!tag) return { error: 'tag is required' }
      return { ids: unique, op: { action: b.action, tag } }
    }
    case 'set-logged':
      if (typeof b.logged !== 'boolean') return { error: 'logged must be a boolean' }
      return { ids: unique, op: { action: 'set-logged', logged: b.logged } }
    case 'delete':
      return { ids: unique, op: { action: 'delete' } }
    default:
      return { error: 'action must be add-tag, remove-tag, set-logged, or delete' }
  }
}
