"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/CopyButton";
import { PersonChip } from "@/components/PersonChip";
import { TagPicker } from "@/components/TagPicker";
import { formatUSD } from "@/lib/money";
import { expenseDay } from "@/lib/expense-filter";

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
  taxCents: number;
  items: {
    id: string;
    name: string;
    quantity: number;
    lineTotalCents: number;
    assignments: { personId: string }[];
  }[];
  tags: string[];
  /** The bank or hand-added charge this split was made from */
  transaction: {
    id: number;
    date: string;
    amount: number;
    source: "PLAID" | "MANUAL";
    account: { name: string; mask: string | null; item: { institutionName: string | null } } | null;
  } | null;
  breakdown: {
    payerId: string;
    perPerson: { personId: string; cents: number }[];
    owes: { personId: string; cents: number }[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** day is YYYY-MM-DD; read as a local date so it never shifts a day */
function formatDate(day: string): string {
  return new Date(`${day}T00:00`).toLocaleDateString("en-US", {
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

  // Tags (saved as soon as they change)
  const [tags, setTags] = useState<string[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);

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
        setTags(exp.tags);
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
  // Tags
  // ---------------------------------------------------------------------------

  async function handleTagsChange(next: string[]) {
    const prev = tags;
    setTags(next); // optimistic
    setTagsError(null);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as { tags: string[] };
      setTags(saved.tags);
    } catch {
      setTags(prev); // revert
      setTagsError("Couldn't save tags — please try again");
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
      router.push(expense.transaction ? `/transactions/${expense.transaction.id}` : "/splits");
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
        <p className="font-display text-4xl uppercase">Expense not found</p>
        <Link href="/splits">
          <Button variant="secondary">Back to splits</Button>
        </Link>
      </div>
    );
  }

  if (loadState === "error" || !expense) {
    return (
      <div className="py-8 space-y-4">
        <p
          className="text-sm text-danger bg-danger-dim border border-danger rounded-3xl px-5 py-4"
          role="alert"
        >
          {loadError ?? "Something went wrong."}
        </p>
        <Link href="/splits">
          <Button variant="secondary">Back to splits</Button>
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

  const editHref = `/expenses/new/${expense.type === "ITEMIZED" ? "itemized" : "simple"}?edit=${expense.id}`;

  return (
    <div className="space-y-8">
      <Link
        href="/splits"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
      >
        ← Splits
      </Link>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {formatDate(expenseDay(expense))} · {expense.type === "ITEMIZED" ? "Receipt" : "Quick split"}
        </p>
        <h1 className="mt-2 font-display text-5xl sm:text-6xl uppercase break-words">{label}</h1>
        <div className="mt-5 flex items-end gap-4 flex-wrap">
          <p className="font-display text-7xl sm:text-8xl tabular-nums leading-none">
            {formatUSD(expense.totalCents)}
          </p>
          <div className="pb-1.5 flex items-center gap-2 text-sm text-ink-muted">
            paid by
            {expense.payer ? (
              <PersonChip name={expense.payer.name} colorHex={expense.payer.colorHex} size="sm" readOnly />
            ) : (
              <span className="text-ink font-semibold">{payerName}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Source charge ───────────────────────────────────────────────── */}
      {expense.transaction && (
        <Link
          href={`/transactions/${expense.transaction.id}`}
          className="flex items-center gap-3 rounded-3xl border border-ink bg-mist px-5 py-3 text-sm hover:bg-sun/40 transition-colors"
        >
          <span className="flex-1 min-w-0 truncate">
            From your{" "}
            <span className="font-semibold">
              {expense.transaction.account
                ? `${expense.transaction.account.item.institutionName ?? expense.transaction.account.name}${
                    expense.transaction.account.mask ? ` •• ${expense.transaction.account.mask}` : ""
                  }`
                : "cash"}
            </span>{" "}
            charge of <span className="font-semibold tabular-nums">{formatUSD(expense.transaction.amount)}</span>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={editHref}>
          <Button variant="primary" size="sm">Edit</Button>
        </Link>
        <button
          type="button"
          onClick={handleToggleLogged}
          disabled={logPending}
          aria-pressed={logged}
          className={[
            "h-8 px-3.5 rounded-full border border-ink text-sm font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun disabled:opacity-50",
            logged ? "bg-mint hover:bg-mint-dim" : "bg-surface hover:bg-sun",
          ].join(" ")}
        >
          {logged ? "✓ Logged in Splitwise" : "Mark as logged"}
        </button>
        <CopyButton summary={copySummary} />
        <div className="ml-auto">
          {!deleteConfirm ? (
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(true)}>
              Delete
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">Delete for good?</span>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
      {deleteError && (
        <p className="text-sm text-danger bg-danger-dim border border-danger rounded-3xl px-5 py-3" role="alert">
          {deleteError}
        </p>
      )}

      {/* ── Who owes what ───────────────────────────────────────────────── */}
      <section aria-labelledby="owes-heading">
        <h2 id="owes-heading" className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Who owes what
        </h2>
        <ul className="rounded-3xl border border-ink divide-y divide-rim overflow-hidden">
          {expense.breakdown.perPerson
            .slice()
            .sort((a, b) => Number(a.personId === expense.payerId) - Number(b.personId === expense.payerId))
            .map(({ personId, cents }) => {
              const person = resolvePerson(personId);
              const name = person?.name ?? personId.slice(0, 8);
              const isPayer = personId === expense.payerId;
              return (
                <li key={personId} className="flex items-center gap-3 px-5 py-3.5">
                  {person ? (
                    <PersonChip name={name} colorHex={person.colorHex} size="sm" readOnly />
                  ) : (
                    <span className="text-sm font-semibold">{name}</span>
                  )}
                  <span className="flex-1 text-sm text-ink-muted">
                    {isPayer ? "paid · their own share" : `owes ${payerName}`}
                  </span>
                  <span
                    className={[
                      "tabular-nums",
                      isPayer ? "text-sm text-ink-muted" : "font-display text-3xl",
                    ].join(" ")}
                  >
                    {formatUSD(cents)}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      {/* ── Items (receipts only) ───────────────────────────────────────── */}
      {expense.type === "ITEMIZED" && expense.items.length > 0 && (
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Items · {expense.items.length}
          </h2>
          <ul className="rounded-3xl border border-ink divide-y divide-rim overflow-hidden">
            {expense.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {item.name}
                    {item.quantity !== 1 && (
                      <span className="font-normal text-ink-muted"> × {item.quantity}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted truncate">
                    {item.assignments.length === expense.breakdown.perPerson.length &&
                    expense.breakdown.perPerson.length > 1
                      ? "Everyone"
                      : item.assignments
                          .map((a) => resolvePerson(a.personId)?.name ?? "?")
                          .join(", ")}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{formatUSD(item.lineTotalCents)}</span>
              </li>
            ))}
            {expense.taxCents > 0 && (
              <li className="flex items-center gap-3 px-5 py-3 bg-mist">
                <p className="flex-1 text-sm text-ink-muted">Tax, split by each person&apos;s items</p>
                <span className="text-sm tabular-nums">{formatUSD(expense.taxCents)}</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      <section aria-labelledby="tags-heading" className="space-y-2">
        <h2 id="tags-heading" className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Tags
        </h2>
        <TagPicker value={tags} onChange={handleTagsChange} />
        {tagsError && (
          <p className="text-xs text-danger" role="alert">
            {tagsError}
          </p>
        )}
      </section>
    </div>
  );
}
