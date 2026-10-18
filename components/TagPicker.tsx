"use client";

/**
 * TagPicker — the tag list as toggle chips; click to add or remove a tag.
 * Tags are created on the Tags page, so this only picks from that list.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagPicker({ value, onChange, disabled }: TagPickerProps) {
  const [tags, setTags] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => (r.ok ? (r.json() as Promise<{ name: string }[]>) : []))
      .then((data) => setTags(data.map((t) => t.name)))
      .catch(() => setTags([]));
  }, []);

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }

  if (tags === null) {
    return <p className="text-sm text-ink-faint">Loading tags…</p>;
  }

  if (tags.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No tags yet.{" "}
        <Link href="/tags" className="font-semibold text-ink underline underline-offset-4">
          Create tags
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const on = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            disabled={disabled}
            aria-pressed={on}
            className={[
              "h-8 px-3.5 text-sm font-semibold rounded-full border border-ink transition-colors",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun",
              "disabled:opacity-50 disabled:pointer-events-none",
              on ? "bg-ink text-white" : "bg-surface text-ink hover:bg-sun",
            ].join(" ")}
          >
            {on ? "✓ " : ""}#{tag}
          </button>
        );
      })}
    </div>
  );
}
