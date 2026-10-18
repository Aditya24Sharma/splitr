"use client";

import { PersonChip } from "@/components/PersonChip";

export interface BulkAssignBarRow {
  id: string;
  assigneeIds: string[];
}

interface Person {
  id: string;
  name: string;
  colorHex: string;
}

interface BulkAssignBarProps {
  selectedRowIds: Set<string>;
  rows: BulkAssignBarRow[];
  people: Person[];
  /** Toggle a person on/off for all selected rows */
  onBulkToggle: (personId: string) => void;
  onClearSelection: () => void;
}

/**
 * Shows when 1+ rows are selected. PersonChip toggles apply to all selected
 * rows at once. A chip is "selected" when every selected row already has that
 * person; partial selections still show the chip as unselected.
 */
export function BulkAssignBar({
  selectedRowIds,
  rows,
  people,
  onBulkToggle,
  onClearSelection,
}: BulkAssignBarProps) {
  if (selectedRowIds.size === 0) return null;

  const selectedRows = rows.filter((r) => selectedRowIds.has(r.id));

  function isFullySelected(personId: string): boolean {
    return (
      selectedRows.length > 0 &&
      selectedRows.every((r) => r.assigneeIds.includes(personId))
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-ink text-white rounded-3xl">
      <span className="text-sm font-semibold shrink-0">
        {selectedRowIds.size} item{selectedRowIds.size > 1 ? "s" : ""} — tap to toggle:
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {people.map((person) => (
          <PersonChip
            key={person.id}
            name={person.name}
            colorHex={person.colorHex}
            selected={isFullySelected(person.id)}
            onClick={() => onBulkToggle(person.id)}
            size="sm"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onClearSelection}
        className="text-sm font-semibold underline underline-offset-4 shrink-0 px-1.5"
        aria-label="Clear row selection"
      >
        Clear
      </button>
    </div>
  );
}
