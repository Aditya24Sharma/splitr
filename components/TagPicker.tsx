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
        <Link href="/tags" className="text-accent hover:underline">
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
              "px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors",
              "disabled:opacity-50 disabled:pointer-events-none",
              on
                ? "bg-accent text-white border-accent"
                : "bg-surface text-ink border-rim hover:border-rim-strong",
            ].join(" ")}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
