"use client";

/**
 * TagInput — removable tag pills plus a text box.
 *
 * Enter or comma adds the typed tag; Backspace on an empty box removes the
 * last one. Leaving the box also adds whatever was typed, so a tag isn't lost
 * if you click Save straight away. Suggestions come from tags already in use.
 */

import { useEffect, useId, useState } from "react";
import { normalizeTag } from "@/lib/tags";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagInput({ value, onChange, disabled }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then(setSuggestions)
      .catch(() => {});
  }, []);

  function addDraft() {
    const tag = normalizeTag(draft);
    setDraft("");
    if (tag && !value.includes(tag)) onChange([...value, tag]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-9 px-2 py-1.5 bg-surface border border-rim rounded-lg focus-within:ring-2 focus-within:ring-accent/25 focus-within:border-accent">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-ink bg-canvas border border-rim rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            disabled={disabled}
            aria-label={`Remove tag ${tag}`}
            className="text-ink-faint hover:text-ink"
          >
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={addDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addDraft();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={value.length === 0 ? "Add a tag, e.g. walmart" : ""}
        className="flex-1 min-w-24 text-sm bg-transparent text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
