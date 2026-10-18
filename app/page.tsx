"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { formatUSD } from "@/lib/money";
import { settleExpenses } from "@/lib/settle";
import { filterExpenses } from "@/lib/expense-filter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Person {
  id: string;
  name: string;
  colorHex: string;
  isDefault: boolean;
  archived: boolean;
}

interface ExpenseListItem {
  id: string;
  type: "ITEMIZED" | "SIMPLE";
  description: string | null;
  store: string | null;
  totalCents: number;
  payerId: string;
  payer: Person;
  loggedToSplitwise: boolean;
  createdAt: string;
  tags: string[];
  itemNames: string[];
  breakdown: {
    perPerson: { personId: string; cents: number }[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [itemQuery, setItemQuery] = useState("");

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const allTags = useMemo(
    () => [...new Set(expenses.flatMap((e) => e.tags))].sort(),
    [expenses],
  );
  const visible = useMemo(
    () => filterExpenses(expenses, filterTags, itemQuery),
    [expenses, filterTags, itemQuery]
  );
  // Only ticked expenses that are currently shown count toward the summary
  const selectedExpenses = useMemo(
    () => visible.map((m) => m.expense).filter((e) => selectedIds.has(e.id)),
    [visible, selectedIds]
  );
  const debts = useMemo(
    () =>
      settleExpenses(
        selectedExpenses.map((e) => ({
          payerId: e.payerId,
          perPerson: e.breakdown.perPerson,
        }))
      ),
    [selectedExpenses]
  );
  const selectedTotalCents = selectedExpenses.reduce(
    (sum, e) => sum + e.totalCents,
    0
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFilterTag(tag: string) {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function personName(id: string): string {
    return personById.get(id)?.name ?? id.slice(0, 6);
  }

  useEffect(() => {
    setLoadState("loading");
    setLoadError(null);

    Promise.all([
      fetch("/api/expenses").then((r) => {
        if (!r.ok) throw new Error(`Failed to load expenses (HTTP ${r.status})`);
        return r.json() as Promise<ExpenseListItem[]>;
      }),
      fetch("/api/people").then((r) => {
        if (!r.ok) return [] as Person[];
        return r.json() as Promise<Person[]>;
      }),
    ])
      .then(([exp, ppl]) => {
        setExpenses(exp);
        setPeople(ppl);
        setLoadState("ready");
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
        setLoadState("error");
      });
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            A record of shared spending — newest first.
          </p>
        </div>

        {/* New expense affordance */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/expenses/new/itemized">
            <Button variant="secondary" size="sm">
              Itemized
            </Button>
          </Link>
          <Link href="/expenses/new/simple">
            <Button variant="primary" size="sm">
              Simple split
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loadState === "loading" && (
        <p className="text-sm text-ink-faint">Loading…</p>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {loadState === "error" && (
        <div
          className="flex items-center gap-3 text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3"
          role="alert"
        >
          <span className="flex-1">{loadError}</span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setLoadState("loading");
              window.location.reload();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length === 0 && (
        <Card padding="lg">
          <div className="text-center space-y-4 py-4">
            <p className="text-sm text-ink-muted">No expenses yet.</p>
            <div className="flex justify-center gap-3">
              <Link href="/expenses/new/simple">
                <Button variant="primary">New simple split</Button>
              </Link>
              <Link href="/expenses/new/itemized">
                <Button variant="secondary">New itemized</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── Search + tag filter ─────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length > 0 && (
        <div className="space-y-3">
          <Input
            type="search"
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
            placeholder="Search items, e.g. milk"
            aria-label="Search items by name"
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-muted mr-1">Tags:</span>
              {allTags.map((tag) => {
                const on = filterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleFilterTag(tag)}
                    aria-pressed={on}
                    className={[
                      "px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors",
                      on
                        ? "bg-accent text-white border-accent"
                        : "bg-surface text-ink border-rim hover:border-rim-strong",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                );
              })}
              {filterTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTags([])}
                  className="text-xs text-ink-muted hover:text-ink ml-1"
                >
                  Clear tags
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Selection summary ───────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length > 0 && (
        <Card padding="md">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink">
              {selectedExpenses.length === 0
                ? "Select expenses to see who owes whom."
                : `Selected: ${selectedExpenses.length} expense${
                    selectedExpenses.length === 1 ? "" : "s"
                  } (${formatUSD(selectedTotalCents)})`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIds(new Set(visible.map((m) => m.expense.id)))
                }
              >
                Select all
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          {selectedExpenses.length > 0 && (
            <ul className="mt-3 space-y-1">
              {debts.length === 0 ? (
                <li className="text-sm text-ink-muted">Nobody owes anything.</li>
              ) : (
                debts.map((d) => (
                  <li
                    key={`${d.fromId}-${d.toId}`}
                    className="flex justify-between gap-4 text-sm text-ink"
                  >
                    <span>
                      {personName(d.fromId)}{" "}
                      <span className="text-ink-muted">owes</span>{" "}
                      {personName(d.toId)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatUSD(d.cents)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </Card>
      )}

      {/* ── Expense list ────────────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length > 0 && visible.length === 0 && (
        <p className="text-sm text-ink-muted">No expenses match.</p>
      )}

      {loadState === "ready" && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map(({ expense: exp, matchedItems }) => {
            const label = exp.store ?? exp.description ?? "Expense";
            const payerName =
              exp.payer?.name ?? personById.get(exp.payerId)?.name ?? "Unknown";

            // Compact per-person glance
            const perPersonGlance = exp.breakdown.perPerson
              .map(({ personId, cents }) => {
                const person =
                  exp.payer?.id === personId
                    ? exp.payer
                    : personById.get(personId);
                const name = person?.name ?? personId.slice(0, 6);
                return `${name} ${formatUSD(cents)}`;
              })
              .join(" · ");

            return (
              <div key={exp.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(exp.id)}
                  onChange={() => toggleSelected(exp.id)}
                  aria-label={`Select ${label}`}
                  className="w-4 h-4 shrink-0 rounded border-rim accent-accent cursor-pointer"
                />
                <Link href={`/expenses/${exp.id}`} className="block flex-1 min-w-0">
                  <Card
                    padding="md"
                    className="hover:border-rim-strong transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Left: date */}
                      <div className="shrink-0 w-12 text-center">
                        <p className="text-xs text-ink-faint tabular-nums">
                          {formatDate(exp.createdAt)}
                        </p>
                      </div>

                      {/* Centre: label + glance */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted truncate">
                          Paid by {payerName}
                          {perPersonGlance ? ` · ${perPersonGlance}` : ""}
                        </p>
                        {matchedItems.length > 0 && (
                          <p className="mt-0.5 text-xs text-ink truncate">
                            Items: {matchedItems.join(", ")}
                          </p>
                        )}
                        {exp.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {exp.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-[11px] font-medium text-ink-muted bg-canvas border border-rim rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: total + logged */}
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-ink tabular-nums">
                          {formatUSD(exp.totalCents)}
                        </p>
                        {exp.loggedToSplitwise && (
                          <p className="mt-0.5 text-xs font-medium text-ink-muted">
                            Logged
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
