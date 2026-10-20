/**
 * SelectionBar — sticks to the bottom of the screen while expenses are ticked.
 * One row of actions; "Settle up", "Shares" and "Tag" open a panel above that row.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "@/components/Link";
import { Button } from "@/components/ui/Button";
import { formatUSD } from "@/lib/money";
import type { Debt } from "@/lib/settle";

interface SelectedExpense {
  id: string;
  totalCents: number;
  loggedToSplitwise: boolean;
  tags: string[];
  breakdown: { perPerson: { personId: string; cents: number }[] };
}

interface SelectionBarProps {
  selected: SelectedExpense[];
  debts: Debt[];
  tagList: string[];
  personName: (id: string) => string;
  /** Runs a POST /api/expenses/bulk action; rejects with a readable error */
  onBulk: (action: Record<string, unknown>) => Promise<void>;
  onClear: () => void;
}

type Panel = "none" | "settle" | "shares" | "tag" | "delete";

export function SelectionBar({
  selected,
  debts,
  tagList,
  personName,
  onBulk,
  onClear,
}: SelectionBarProps) {
  const [panel, setPanel] = useState<Panel>("none");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const count = selected.length;
  const totalCents = selected.reduce((sum, e) => sum + e.totalCents, 0);
  const allLogged = selected.every((e) => e.loggedToSplitwise);

  // Each person's share summed across the selection, whoever paid; largest first
  const shareCents = new Map<string, number>();
  for (const e of selected) {
    for (const { personId, cents } of e.breakdown.perPerson) {
      shareCents.set(personId, (shareCents.get(personId) ?? 0) + cents);
    }
  }
  const shares = [...shareCents].sort(
    ([a, x], [b, y]) => y - x || personName(a).localeCompare(personName(b))
  );

  // Esc closes the open panel first, then clears the selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (panel !== "none") setPanel("none");
      else onClear();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, onClear]);

  function toggle(p: Panel) {
    setPanel((cur) => (cur === p ? "none" : p));
  }

  async function run(action: Record<string, unknown>, closeAfter = false) {
    setPending(true);
    try {
      await onBulk(action);
      if (closeAfter) setPanel("none");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function copyDebts() {
    const text = debts
      .map((d) => `${personName(d.fromId)} owes ${personName(d.toId)} ${formatUSD(d.cents)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable; nothing to do
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[var(--tabbar)] sm:bottom-0 z-50 px-3 pb-3 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div
        className="rise pointer-events-auto mx-auto max-w-3xl rounded-3xl border border-ink bg-sun shadow-[0_8px_0_0_#0B0B0C]"
        role="region"
        aria-label="Selected expenses"
      >
        {/* ── Panel ─────────────────────────────────────────────────────── */}
        {panel === "settle" && (
          <div className="px-5 pt-5 pb-2">
            {debts.length === 0 ? (
              <p className="text-sm font-medium">Nobody owes anything here.</p>
            ) : (
              <ul className="space-y-1.5">
                {debts.map((d) => (
                  <li key={`${d.fromId}-${d.toId}`} className="flex items-baseline gap-3">
                    <span className="flex-1 min-w-0 truncate text-sm">
                      <span className="font-semibold">{personName(d.fromId)}</span>
                      <span className="text-ink/60"> pays </span>
                      <span className="font-semibold">{personName(d.toId)}</span>
                    </span>
                    <span className="font-display text-3xl tabular-nums">
                      {formatUSD(d.cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {debts.length > 0 && (
              <button
                type="button"
                onClick={copyDebts}
                className="mt-3 text-sm font-semibold underline underline-offset-4"
              >
                {copied ? "Copied" : "Copy for Splitwise"}
              </button>
            )}
          </div>
        )}

        {panel === "shares" && (
          <div className="px-5 pt-5 pb-2">
            <ul className="space-y-1.5">
              {shares.map(([personId, cents]) => (
                <li key={personId} className="flex items-baseline gap-3">
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold">
                    {personName(personId)}
                  </span>
                  <span className="font-display text-3xl tabular-nums">{formatUSD(cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {panel === "tag" && (
          <div className="px-5 pt-5 pb-2">
            {tagList.length === 0 ? (
              <p className="text-sm">
                No tags yet.{" "}
                <Link href="/tags" className="font-semibold underline underline-offset-4">
                  Create tags
                </Link>
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-ink/70 mb-2">
                  Filled = on every selected expense. Click to add or remove.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tagList.map((tag) => {
                    const onAll = selected.every((e) => e.tags.includes(tag));
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={pending}
                        onClick={() => run({ action: onAll ? "remove-tag" : "add-tag", tag })}
                        aria-pressed={onAll}
                        className={[
                          "h-8 px-3 rounded-full border border-ink text-sm font-semibold transition-colors disabled:opacity-50",
                          onAll ? "bg-ink text-white" : "bg-surface hover:bg-mist",
                        ].join(" ")}
                      >
                        {onAll ? "✓ " : "+ "}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {panel === "delete" && (
          <div className="px-5 pt-5 pb-2 flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold flex-1 min-w-40">
              Delete {count} expense{count === 1 ? "" : "s"}? This can&apos;t be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => run({ action: "delete" }, true)}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        )}

        {/* ── Action row: summary on top on phones, one line on desktop ── */}
        <div className="px-3 py-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
          <div className="flex items-center justify-between sm:mr-auto">
            <p className="pl-2 text-sm">
              <span className="font-semibold">{count} selected</span>
              <span className="text-ink/70"> · {formatUSD(totalCents)}</span>
            </p>
            <ClearButton onClear={onClear} className="inline-flex sm:hidden" />
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-2">
            <Button
              variant={panel === "settle" ? "primary" : "secondary"}
              size="sm"
              className="px-2 sm:px-3.5"
              onClick={() => toggle("settle")}
            >
              Settle<span className="hidden sm:inline">up</span>
            </Button>
            <Button
              variant={panel === "shares" ? "primary" : "secondary"}
              size="sm"
              className="px-2 sm:px-3.5"
              onClick={() => toggle("shares")}
            >
              Shares
            </Button>
            <Button
              variant={panel === "tag" ? "primary" : "secondary"}
              size="sm"
              className="px-2 sm:px-3.5"
              onClick={() => toggle("tag")}
            >
              Tag
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="px-2 sm:px-3.5"
              disabled={pending}
              onClick={() => run({ action: "set-logged", logged: !allLogged })}
            >
              <span className="sm:hidden">{allLogged ? "Unlog" : "Log"}</span>
              <span className="hidden sm:inline">{allLogged ? "Mark not logged" : "Mark logged"}</span>
            </Button>
            <Button
              variant={panel === "delete" ? "danger" : "secondary"}
              size="sm"
              className="px-2 sm:px-3.5"
              onClick={() => toggle("delete")}
            >
              Delete
            </Button>
          </div>
          <ClearButton onClear={onClear} className="hidden sm:inline-flex" />
        </div>
      </div>
    </div>
  );
}

function ClearButton({ onClear, className }: { onClear: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label="Clear selection"
      className={`${className} w-8 h-8 shrink-0 rounded-full items-center justify-center text-lg leading-none hover:bg-ink hover:text-white transition-colors`}
    >
      ×
    </button>
  );
}
