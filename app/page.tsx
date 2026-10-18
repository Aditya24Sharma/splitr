"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { formatUSD } from "@/lib/money";
import { settleExpenses } from "@/lib/settle";
import {
  filterExpenses,
  expenseDay,
  NO_FILTERS,
  type ExpenseFilters,
} from "@/lib/expense-filter";

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
  purchasedAt: string | null;
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

/** day is YYYY-MM-DD; read as a local date so it never shifts a day */
function formatDate(day: string): string {
  const d = new Date(`${day}T00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

const SELECT_CLASS =
  "w-full px-2 h-9 text-sm bg-surface text-ink rounded-lg border border-rim focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent";

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
  const [filters, setFilters] = useState<ExpenseFilters>(NO_FILTERS);
  // Every tag on the Tags page (for bulk add/remove), not just ones in use
  const [tagList, setTagList] = useState<string[]>([]);

  // Bulk actions on ticked expenses
  const [bulkTag, setBulkTag] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const allTags = useMemo(
    () => [...new Set(expenses.flatMap((e) => e.tags))].sort(),
    [expenses],
  );
  const visible = useMemo(
    () => filterExpenses(expenses, filters),
    [expenses, filters]
  );
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
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

  function setFilter<K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFilterTag(tag: string) {
    setFilter(
      "tags",
      filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag]
    );
  }

  async function runBulk(action: Record<string, unknown>) {
    setBulkPending(true);
    setBulkError(null);
    try {
      const ids = selectedExpenses.map((e) => e.id);
      const res = await fetch("/api/expenses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      }
      if (action.action === "delete") setSelectedIds(new Set());
      const listRes = await fetch("/api/expenses");
      if (listRes.ok) setExpenses((await listRes.json()) as ExpenseListItem[]);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBulkPending(false);
      setConfirmDelete(false);
    }
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
      fetch("/api/tags").then((r) => {
        if (!r.ok) return [] as { name: string }[];
        return r.json() as Promise<{ name: string }[]>;
      }),
    ])
      .then(([exp, ppl, tgs]) => {
        setExpenses(exp);
        setPeople(ppl);
        setTagList(tgs.map((t) => t.name));
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

      {/* ── Search + filters ────────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length > 0 && (
        <div className="space-y-3">
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder="Search expenses or items, e.g. gas or milk"
            aria-label="Search expenses and items by name"
          />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              From
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilter("from", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              To
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilter("to", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Person
              <select
                value={filters.personId}
                onChange={(e) => setFilter("personId", e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Anyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Paid by
              <select
                value={filters.payerId}
                onChange={(e) => setFilter("payerId", e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Anyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Splitwise
              <select
                value={filters.logged}
                onChange={(e) =>
                  setFilter("logged", e.target.value as ExpenseFilters["logged"])
                }
                className={SELECT_CLASS}
              >
                <option value="all">All</option>
                <option value="not-logged">Not logged</option>
                <option value="logged">Logged</option>
              </select>
            </label>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-muted mr-1">Tags:</span>
              {allTags.map((tag) => {
                const on = filters.tags.includes(tag);
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
            </div>
          )}
          {filtersActive && (
            <div className="flex items-center gap-3 text-xs text-ink-muted">
              <span>
                Showing {visible.length} of {expenses.length} expenses
              </span>
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="hover:text-ink underline"
              >
                Clear filters
              </button>
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
            <div className="mt-3 pt-3 border-t border-rim space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bulkTag}
                  onChange={(e) => setBulkTag(e.target.value)}
                  disabled={bulkPending}
                  aria-label="Tag to add or remove"
                  className={`${SELECT_CLASS} w-auto`}
                >
                  <option value="">Choose a tag…</option>
                  {tagList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!bulkTag || bulkPending}
                  onClick={() => runBulk({ action: "add-tag", tag: bulkTag })}
                >
                  Add tag
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!bulkTag || bulkPending}
                  onClick={() => runBulk({ action: "remove-tag", tag: bulkTag })}
                >
                  Remove tag
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={bulkPending}
                  onClick={() => runBulk({ action: "set-logged", logged: true })}
                >
                  Mark logged
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={bulkPending}
                  onClick={() => runBulk({ action: "set-logged", logged: false })}
                >
                  Mark not logged
                </Button>
                {confirmDelete ? (
                  <>
                    <span className="text-sm text-ink-muted">
                      Delete {selectedExpenses.length} expense
                      {selectedExpenses.length === 1 ? "" : "s"}? This can&apos;t be undone.
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={bulkPending}
                      onClick={() => runBulk({ action: "delete" })}
                    >
                      {bulkPending ? "Deleting…" : "Delete"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={bulkPending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                )}
              </div>
              {bulkError && (
                <p className="text-xs text-danger" role="alert">
                  {bulkError}
                </p>
              )}
            </div>
          )}
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
                          {formatDate(expenseDay(exp))}
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
