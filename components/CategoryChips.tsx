"use client";

import { categoryColor, categoryLabel } from "@/lib/spending";

/** Single-choice category picker: pills with a color dot. */
export function CategoryChips({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (category: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
      {options.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={[
              "h-8 pl-2 pr-3 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun disabled:opacity-50",
              on ? "border-ink bg-sun" : "border-rim bg-surface text-ink-muted hover:border-ink hover:text-ink",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-full border border-ink"
              style={{ backgroundColor: categoryColor(c) }}
            />
            {categoryLabel(c)}
          </button>
        );
      })}
    </div>
  );
}
