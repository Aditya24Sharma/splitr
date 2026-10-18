"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/CopyButton";
import { PersonChip } from "@/components/PersonChip";
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

interface Expense {
  id: string;
  type: "ITEMIZED" | "SIMPLE";
  description: string | null;
  store: string | null;
  purchasedAt: string | null;
  totalCents: number;
  payerId: string;
  payer: Person;
  loggedToSplitwise: boolean;
  createdAt: string;
  splitMethod: "EVEN" | "EXACT" | "ITEMIZED";
  breakdown: {
    payerId: string;
    perPerson: { personId: string; cents: number }[];
    owes: { personId: string; cents: number }[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "notfound" | "ready">(
    "loading"
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // Optimistic logged state
  const [logged, setLogged] = useState(false);
  const [logPending, setLogPending] = useState(false);

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setLoadState("loading");
    setLoadError(null);

    Promise.all([
      fetch(`/api/expenses/${id}`).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Failed to load expense (HTTP ${r.status})`);
        return r.json() as Promise<Expense>;
      }),
      fetch("/api/people").then((r) => {
        if (!r.ok) return [] as Person[];
        return r.json() as Promise<Person[]>;
      }),
    ])
      .then(([exp, ppl]) => {
        if (!exp) {
          setLoadState("notfound");
          return;
        }
        setExpense(exp);
        setLogged(exp.loggedToSplitwise);
        setPeople(ppl);
        setLoadState("ready");
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
        setLoadState("error");
      });
  }, [id]);

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  // ---------------------------------------------------------------------------
  // Mark logged toggle
  // ---------------------------------------------------------------------------

  async function handleToggleLogged() {
    if (!expense || logPending) return;
    const newVal = !logged;
    setLogged(newVal); // optimistic
    setLogPending(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loggedToSplitwise: newVal }),
      });
      if (!res.ok) {
        setLogged(!newVal); // revert
      }
    } catch {
      setLogged(!newVal); // revert
    } finally {
      setLogPending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!expense || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Error ${res.status}`
        );
      }
      router.push("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Delete failed — please try again"
      );
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Copy summary
  // ---------------------------------------------------------------------------

  const copySummary = useMemo(() => {
    if (!expense) return "";
    const label = expense.store ?? expense.description ?? "Expense";
    const payerName = expense.payer?.name ?? "Unknown";
    const header = `${label} — ${formatUSD(expense.totalCents)} (paid by ${payerName})`;
    const lines = expense.breakdown.owes.map(({ personId, cents }) => {
      const person =
        personById.get(personId) ??
        (expense.payer?.id === personId ? expense.payer : undefined);
      const name = person?.name ?? personId.slice(0, 8);
      return `${name} owes ${payerName} ${formatUSD(cents)}`;
    });
    return [header, ...lines].join("\n");
  }, [expense, personById]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loadState === "loading") {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
    );
  }

  if (loadState === "notfound") {
    return (
      <div className="py-16 space-y-4 text-center">
        <p className="text-sm text-ink-muted">Expense not found.</p>
        <Link href="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !expense) {
    return (
      <div className="py-8 space-y-4">
        <p
          className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3"
          role="alert"
        >
          {loadError ?? "Something went wrong."}
        </p>
        <Link href="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </div>
    );
  }

  const label = expense.store ?? expense.description ?? "Expense";
  const payerName = expense.payer?.name ?? "Unknown";

  // Resolve a person by ID — graceful for archived/missing
  function resolvePerson(personId: string): Person | undefined {
    if (expense!.payer?.id === personId) return expense!.payer;
    return personById.get(personId);
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 pb-16">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        ← All expenses
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {label}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDate(expense.createdAt)}
          {expense.type === "ITEMIZED" ? " · Itemized" : " · Simple split"}
        </p>
      </div>

      {/* ── Summary card ─────────────────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-ink-muted font-medium">Total</p>
          <p className="text-2xl font-semibold text-ink tabular-nums">
            {formatUSD(expense.totalCents)}
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-rim pt-4">
          <p className="text-sm text-ink-muted">Paid by</p>
          {expense.payer ? (
            <PersonChip
              name={expense.payer.name}
              colorHex={expense.payer.colorHex}
              size="sm"
              readOnly
            />
          ) : (
            <span className="text-sm text-ink">{payerName}</span>
          )}
        </div>
      </Card>

      {/* ── Per-person breakdown ─────────────────────────────────────────── */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-ink mb-3">Breakdown</h2>
        <div className="space-y-2">
          {expense.breakdown.perPerson.map(({ personId, cents }) => {
            const person = resolvePerson(personId);
            const name = person?.name ?? personId.slice(0, 8);
            const isPayer = personId === expense.payerId;
            return (
              <div
                key={personId}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  {person ? (
                    <PersonChip
                      name={name}
                      colorHex={person.colorHex}
                      size="sm"
                      readOnly
                    />
                  ) : (
                    <span className="text-ink-muted text-xs">{name}</span>
                  )}
                  {isPayer && (
                    <span className="text-xs text-ink-muted">(payer)</span>
                  )}
                </div>
                <span className="font-semibold tabular-nums text-ink">
                  {formatUSD(cents)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Owes section */}
        {expense.breakdown.owes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-rim">
            <p className="text-xs font-medium text-ink-muted mb-2">
              Settles up with {payerName}
            </p>
            <div className="space-y-1.5">
              {expense.breakdown.owes.map(({ personId, cents }) => {
                const person = resolvePerson(personId);
                const name = person?.name ?? personId.slice(0, 8);
                return (
                  <div
                    key={personId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ink-muted">{name}</span>
                    <span className="tabular-nums text-ink">
                      {formatUSD(cents)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <Card padding="md">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CopyButton summary={copySummary} />

            <button
              type="button"
              onClick={handleToggleLogged}
              disabled={logPending}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                "disabled:opacity-50 disabled:pointer-events-none",
                logged
                  ? "bg-canvas border-rim text-ink-muted hover:bg-surface"
                  : "bg-surface border-rim text-ink hover:bg-canvas",
              ].join(" ")}
              aria-pressed={logged}
            >
              {logPending
                ? "Updating…"
                : logged
                ? "Logged to Splitwise"
                : "Mark as logged"}
            </button>
          </div>

          {/* Delete */}
          {!deleteConfirm ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
            >
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted hidden sm:block">
                Delete this expense?
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Confirm"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {deleteError && (
          <p
            className="mt-3 text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
            role="alert"
          >
            {deleteError}
          </p>
        )}
      </Card>
    </div>
  );
}
