"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PersonChip } from "@/components/PersonChip";
import { TagPicker } from "@/components/TagPicker";
import { toCents, formatUSD } from "@/lib/money";
import { splitSimpleEven, splitSimpleExact } from "@/lib/split";
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

type SplitMethod = "EVEN" | "EXACT";

/** The parts of GET /api/expenses/[id] this form needs when editing */
interface SavedExpense {
  type: "ITEMIZED" | "SIMPLE";
  description: string;
  purchasedAt: string | null;
  createdAt: string;
  totalCents: number;
  payerId: string;
  splitMethod: SplitMethod | "ITEMIZED";
  tags: string[];
  participants: { personId: string; exactAmountCents: number | null }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSavedExpense(id: string): Promise<SavedExpense> {
  const r = await fetch(`/api/expenses/${id}`);
  if (r.status === 404) throw new Error("Expense not found.");
  if (!r.ok) throw new Error(`Failed to load expense (HTTP ${r.status})`);
  return r.json() as Promise<SavedExpense>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewSimplePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  // ?edit=<id> opens this form pre-filled to edit a saved expense
  const { edit: editId } = use(searchParams);
  const router = useRouter();
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  // People
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

  // Form state
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // YYYY-MM-DD; defaults to today
  const [purchasedAt, setPurchasedAt] = useState(() =>
    expenseDay({ purchasedAt: null, createdAt: new Date().toISOString() })
  );
  const [amountDollars, setAmountDollars] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("EVEN");

  // Exact-split per-person inputs: personId → dollar string
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load people
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setPeopleLoading(true);
    Promise.all([
      fetch("/api/people").then((r) => r.json() as Promise<Person[]>),
      editId ? loadSavedExpense(editId) : null,
    ])
      .then(([data, saved]) => {
        setPeople(data);
        if (saved) {
          const active = new Set(data.map((p) => p.id));
          const involved = [saved.payerId, ...saved.participants.map((p) => p.personId)];
          if (saved.type !== "SIMPLE") throw new Error("This is not a simple expense.");
          if (!involved.every((id) => active.has(id))) {
            throw new Error("This expense includes an archived person, so it can't be edited.");
          }
          setDescription(saved.description);
          setTags(saved.tags);
          setPurchasedAt(expenseDay(saved));
          setAmountDollars((saved.totalCents / 100).toFixed(2));
          setPayerId(saved.payerId);
          setParticipantIds(new Set(saved.participants.map((p) => p.personId)));
          setSplitMethod(saved.splitMethod === "EXACT" ? "EXACT" : "EVEN");
          setExactAmounts(
            Object.fromEntries(
              saved.participants
                .filter((p) => p.exactAmountCents !== null)
                .map((p) => [p.personId, (p.exactAmountCents! / 100).toFixed(2)])
            )
          );
          return;
        }
        const def = data.find((p) => p.isDefault) ?? data[0];
        if (def) setPayerId(def.id);
        // Pre-check default (roommate) people
        const defaultIds = new Set(
          data.filter((p) => p.isDefault).map((p) => p.id)
        );
        setParticipantIds(defaultIds.size > 0 ? defaultIds : new Set());
      })
      .catch((err) => {
        if (editId) {
          setEditLoadError(err instanceof Error ? err.message : "Couldn't load the expense.");
        }
      })
      .finally(() => setPeopleLoading(false));
  }, [editId]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalCents = useMemo(() => {
    const v = parseFloat(amountDollars);
    return isNaN(v) ? 0 : toCents(v);
  }, [amountDollars]);

  const participantList = useMemo(
    () => people.filter((p) => participantIds.has(p.id)),
    [people, participantIds]
  );

  // For EXACT: sum of entered amounts in cents
  const exactSumCents = useMemo(() => {
    if (splitMethod !== "EXACT") return 0;
    return participantList.reduce((sum, p) => {
      const v = parseFloat(exactAmounts[p.id] ?? "");
      return sum + (isNaN(v) ? 0 : toCents(v));
    }, 0);
  }, [splitMethod, participantList, exactAmounts]);

  const exactSumMatchesTotal =
    totalCents > 0 && exactSumCents === totalCents;

  const exactHasAllAmounts = participantList.every(
    (p) => !isNaN(parseFloat(exactAmounts[p.id] ?? ""))
  );

  // Live breakdown preview
  const liveBreakdown = useMemo(() => {
    if (participantList.length === 0 || totalCents === 0) return null;
    try {
      if (splitMethod === "EVEN") {
        return splitSimpleEven(
          totalCents,
          participantList.map((p) => p.id)
        );
      } else {
        if (!exactHasAllAmounts || !exactSumMatchesTotal) return null;
        return splitSimpleExact(
          totalCents,
          participantList.map((p) => ({
            personId: p.id,
            cents: toCents(parseFloat(exactAmounts[p.id])),
          }))
        );
      }
    } catch {
      return null;
    }
  }, [
    splitMethod,
    totalCents,
    participantList,
    exactAmounts,
    exactHasAllAmounts,
    exactSumMatchesTotal,
  ]);

  // Person lookup map
  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!description.trim()) return false;
    if (totalCents <= 0) return false;
    if (!payerId) return false;
    if (participantList.length === 0) return false;
    if (splitMethod === "EXACT") {
      if (!exactHasAllAmounts) return false;
      if (!exactSumMatchesTotal) return false;
    }
    return true;
  }, [
    saving,
    description,
    totalCents,
    payerId,
    participantList,
    splitMethod,
    exactHasAllAmounts,
    exactSumMatchesTotal,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setExactAmount(personId: string, value: string) {
    setExactAmounts((prev) => ({ ...prev, [personId]: value }));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);

    const payload = {
      type: "SIMPLE" as const,
      description: description.trim(),
      purchasedAt,
      tags,
      payerId,
      totalCents,
      splitMethod,
      participants: participantList.map((p) => ({
        personId: p.id,
        ...(splitMethod === "EXACT"
          ? { exactAmountCents: toCents(parseFloat(exactAmounts[p.id])) }
          : {}),
      })),
    };

    try {
      const res = await fetch(editId ? `/api/expenses/${editId}` : "/api/expenses", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        router.push(`/expenses/${id}`);
        return;
      }

      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `Server error ${res.status}`
      );
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Save failed — please try again"
      );
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render — edit load failure
  // ---------------------------------------------------------------------------

  if (editLoadError) {
    return (
      <div className="py-8 space-y-4">
        <p
          className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3"
          role="alert"
        >
          {editLoadError}
        </p>
        <Link href={`/expenses/${editId}`}>
          <Button variant="secondary">Back to expense</Button>
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — no-people guard
  // ---------------------------------------------------------------------------

  if (!peopleLoading && people.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-ink">
          New simple expense
        </h1>
        <Card padding="lg">
          <div className="text-center space-y-4">
            <p className="text-sm text-ink">
              Add roommates first — you need at least one person to split an
              expense with.
            </p>
            <Link href="/people">
              <Button variant="primary">Add roommates</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 pb-16">
      {/* Page heading */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {editId ? "Edit simple expense" : "New simple expense"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {editId
            ? "Saving clears “logged to Splitwise” so you remember to update it there."
            : "Split a fixed total evenly or by exact amounts."}
        </p>
      </div>

      {/* ── Description & Amount ─────────────────────────────────────────── */}
      <Card padding="md">
        <div className="space-y-4">
          <Field label="Description" htmlFor="description-input">
            <Input
              id="description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner, groceries, utilities…"
            />
          </Field>

          <Field label="Tags" hint="Click to add or remove. Manage the list on the Tags page.">
            <TagPicker value={tags} onChange={setTags} />
          </Field>

          <Field label="Date" htmlFor="date-input">
            <Input
              id="date-input"
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </Field>

          <Field label="Total amount ($)" htmlFor="amount-input">
            <Input
              id="amount-input"
              type="number"
              min="0"
              step="0.01"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
      </Card>

      {/* ── Payer ─────────────────────────────────────────────────────────── */}
      <Card padding="md">
        <Field label="Paid by" htmlFor="payer-select">
          {peopleLoading ? (
            <p className="text-sm text-ink-faint h-9 flex items-center">
              Loading…
            </p>
          ) : (
            <select
              id="payer-select"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full px-3 py-2 h-9 text-sm bg-surface text-ink rounded-lg border border-rim focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent transition-colors"
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </Card>

      {/* ── Participants ──────────────────────────────────────────────────── */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-ink mb-3">
          Participants
        </h2>
        {peopleLoading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <PersonChip
                key={p.id}
                name={p.name}
                colorHex={p.colorHex}
                selected={participantIds.has(p.id)}
                onClick={() => toggleParticipant(p.id)}
              />
            ))}
          </div>
        )}
        {participantList.length === 0 && !peopleLoading && (
          <p
            className="mt-3 text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
            role="alert"
          >
            Select at least one participant.
          </p>
        )}
      </Card>

      {/* ── Split method ──────────────────────────────────────────────────── */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-ink mb-3">Split method</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSplitMethod("EVEN")}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              splitMethod === "EVEN"
                ? "bg-accent text-white border-accent"
                : "bg-surface text-ink border-rim hover:bg-canvas",
            ].join(" ")}
          >
            Even
          </button>
          <button
            type="button"
            onClick={() => setSplitMethod("EXACT")}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              splitMethod === "EXACT"
                ? "bg-accent text-white border-accent"
                : "bg-surface text-ink border-rim hover:bg-canvas",
            ].join(" ")}
          >
            Exact
          </button>
        </div>

        {/* Exact-amount inputs */}
        {splitMethod === "EXACT" && participantList.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-ink-muted">
              Enter each person&apos;s exact share. They must sum to the total.
            </p>
            {participantList.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <PersonChip
                  name={p.name}
                  colorHex={p.colorHex}
                  size="sm"
                  readOnly
                />
                <div className="flex-1 max-w-[9rem]">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={exactAmounts[p.id] ?? ""}
                    onChange={(e) => setExactAmount(p.id, e.target.value)}
                    aria-label={`${p.name}'s share`}
                  />
                </div>
              </div>
            ))}

            {/* Running sum vs total */}
            {totalCents > 0 && exactHasAllAmounts && (
              <div
                className={[
                  "flex justify-between text-sm px-3 py-2 rounded-lg border",
                  exactSumMatchesTotal
                    ? "border-rim bg-canvas text-ink"
                    : "border-danger/20 bg-danger-dim text-danger",
                ].join(" ")}
                role="status"
              >
                <span>
                  {exactSumMatchesTotal ? "Sums correctly" : "Sum so far"}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatUSD(exactSumCents)}
                  {!exactSumMatchesTotal && (
                    <span className="font-normal text-ink-muted ml-1">
                      / {formatUSD(totalCents)}
                    </span>
                  )}
                </span>
              </div>
            )}

            {totalCents > 0 && !exactHasAllAmounts && (
              <p
                className="text-sm text-ink-muted bg-canvas border border-rim rounded-lg px-3 py-2"
                role="status"
              >
                Enter an amount for every participant.
              </p>
            )}

            {totalCents > 0 && !exactSumMatchesTotal && exactHasAllAmounts && (
              <p
                className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
                role="alert"
              >
                Amounts must sum to {formatUSD(totalCents)} (
                {exactSumCents < totalCents
                  ? `${formatUSD(totalCents - exactSumCents)} short`
                  : `${formatUSD(exactSumCents - totalCents)} over`}
                ).
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Live breakdown ─────────────────────────────────────────────────── */}
      {liveBreakdown && liveBreakdown.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-ink mb-3">Breakdown</h3>
          <div className="space-y-2">
            {liveBreakdown.map(({ personId, cents }) => {
              const person = personById.get(personId);
              if (!person) return null;
              return (
                <div
                  key={personId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink">
                    {person.name}
                    {personId === payerId && (
                      <span className="ml-1.5 text-xs font-medium text-ink-muted">
                        (payer)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {formatUSD(cents)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-rim flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatUSD(totalCents)}</span>
          </div>
        </Card>
      )}

      {/* ── Save error ────────────────────────────────────────────────────── */}
      {saveError && (
        <p
          className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
          role="alert"
        >
          {saveError}
        </p>
      )}

      {/* ── Action bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {saving ? "Saving…" : editId ? "Save changes" : "Save expense"}
        </Button>
        <Link href={editId ? `/expenses/${editId}` : "/"}>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  );
}
