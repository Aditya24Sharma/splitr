export interface FilterableExpense {
  tags: string[]
  itemNames: string[]
}

export interface ExpenseMatch<T> {
  expense: T
  /** Item names containing the search text; empty when there is no search */
  matchedItems: string[]
}

/**
 * Keeps expenses that have ANY of the selected tags (all expenses when none are
 * selected) and, when `query` is non-blank, at least one item whose name
 * contains it (case-insensitive).
 */
export function filterExpenses<T extends FilterableExpense>(
  expenses: T[],
  selectedTags: string[],
  query: string,
): ExpenseMatch<T>[] {
  const q = query.trim().toLowerCase()
  const result: ExpenseMatch<T>[] = []
  for (const expense of expenses) {
    if (selectedTags.length > 0 && !expense.tags.some(t => selectedTags.includes(t))) continue
    const matchedItems = q ? expense.itemNames.filter(n => n.toLowerCase().includes(q)) : []
    if (q && matchedItems.length === 0) continue
    result.push({ expense, matchedItems })
  }
  return result
}
