"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatUSD } from "@/lib/money";

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

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

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

      {/* ── Expense list ────────────────────────────────────────────────── */}
      {loadState === "ready" && expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((exp) => {
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
              <Link key={exp.id} href={`/expenses/${exp.id}`} className="block">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
