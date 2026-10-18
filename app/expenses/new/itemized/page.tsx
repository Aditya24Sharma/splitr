"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ItemTable, type ItemRow } from "@/components/ItemTable";
import { BulkAssignBar } from "@/components/BulkAssignBar";
import { BreakdownCard } from "@/components/BreakdownCard";
import { CopyButton } from "@/components/CopyButton";
import { TagPicker } from "@/components/TagPicker";
import { toCents, formatUSD } from "@/lib/money";
import { splitItemized } from "@/lib/split";
import type { ParsedReceipt } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(assigneeIds: string[] = []): ItemRow {
  return {
    id: crypto.randomUUID(),
    rawName: null,
    name: "",
    quantity: "1",
    unitPrice: "0.00",
    lineTotal: "0.00",
    assigneeIds,
  };
}

function parsedItemToRow(
  it: ParsedReceipt["items"][number],
  assigneeIds: string[]
): ItemRow {
  return {
    id: crypto.randomUUID(),
    rawName: it.rawName,
    name: it.name,
    quantity: String(it.quantity),
    unitPrice: it.unitPrice.toFixed(2),
    lineTotal: it.lineTotal.toFixed(2),
    assigneeIds,
  };
}

/** The parts of GET /api/expenses/[id] this form needs when editing */
interface SavedExpense {
  type: "ITEMIZED" | "SIMPLE";
  store: string | null;
  purchasedAt: string | null;
  taxCents: number;
  payerId: string;
  tags: string[];
  items: {
    rawName: string | null;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    assignments: { personId: string }[];
  }[];
}

async function loadSavedExpense(id: string): Promise<SavedExpense> {
  const r = await fetch(`/api/expenses/${id}`);
  if (r.status === 404) throw new Error("Expense not found.");
  if (!r.ok) throw new Error(`Failed to load expense (HTTP ${r.status})`);
  return r.json() as Promise<SavedExpense>;
}

function savedItemToRow(it: SavedExpense["items"][number]): ItemRow {
  return {
    id: crypto.randomUUID(),
    rawName: it.rawName,
    name: it.name,
    quantity: String(it.quantity),
    unitPrice: (it.unitPriceCents / 100).toFixed(2),
    lineTotal: (it.lineTotalCents / 100).toFixed(2),
    assigneeIds: it.assignments.map((a) => a.personId),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewItemizedPage({
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

  // Flow
  const [step, setStep] = useState<"photo" | "table">("photo");

  // Parse state
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parsedTotal, setParsedTotal] = useState<number | null>(null);

  // Table data
  const [store, setStore] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [purchasedAt, setPurchasedAt] = useState("");
  const [taxDollars, setTaxDollars] = useState("0.00");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Payer
  const [payerId, setPayerId] = useState("");

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // File input ref (hidden, triggered by button)
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          const involved = [
            saved.payerId,
            ...saved.items.flatMap((it) => it.assignments.map((a) => a.personId)),
          ];
          if (saved.type !== "ITEMIZED") throw new Error("This is not an itemized expense.");
          if (!involved.every((id) => active.has(id))) {
            throw new Error("This expense includes an archived person, so it can't be edited.");
          }
          setStore(saved.store ?? "");
          setTags(saved.tags);
          setPurchasedAt(saved.purchasedAt ? saved.purchasedAt.slice(0, 10) : "");
          setTaxDollars((saved.taxCents / 100).toFixed(2));
          setRows(saved.items.map(savedItemToRow));
          setPayerId(saved.payerId);
          setStep("table");
          return;
        }
        const def = data.find((p) => p.isDefault) ?? data[0];
        if (def) setPayerId(def.id);
      })
      .catch((err) => {
        if (editId) {
          setEditLoadError(err instanceof Error ? err.message : "Couldn't load the expense.");
        }
      })
      .finally(() => setPeopleLoading(false));
  }, [editId]);

  // Derived: IDs of default (roommate) people — used as initial assignees
  const defaultAssigneeIds = people
    .filter((p) => p.isDefault)
    .map((p) => p.id);

  // ---------------------------------------------------------------------------
  // Photo step
  // ---------------------------------------------------------------------------

  function enterManually() {
    const ids = people.filter((p) => p.isDefault).map((p) => p.id);
    setRows([makeRow(ids)]);
    setParseError(null);
    setStep("table");
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParseError(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/expenses/parse-receipt", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            `Parse failed (HTTP ${res.status})`
        );
      }

      const parsed: ParsedReceipt = await res.json();
      const ids = people.filter((p) => p.isDefault).map((p) => p.id);

      setRows(parsed.items.map((it) => parsedItemToRow(it, ids)));
      setStore(parsed.store ?? "");
      setPurchasedAt(
        parsed.purchasedAt ? parsed.purchasedAt.slice(0, 10) : ""
      );
      setTaxDollars(parsed.tax.toFixed(2));
      setParsedTotal(parsed.total);
      setParseWarnings(parsed.warnings ?? []);
      setStep("table");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Receipt parse failed";
      setParseError(msg);
      // Fall back to an empty editable table so manual entry is always available
      const ids = people.filter((p) => p.isDefault).map((p) => p.id);
      setRows([makeRow(ids)]);
      setStep("table");
    } finally {
      setParsing(false);
      // Reset input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ---------------------------------------------------------------------------
  // Table handlers
  // ---------------------------------------------------------------------------

  function handleRowChange(id: string, field: string, value: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated: ItemRow = { ...row, [field]: value };
        // Auto-compute lineTotal when qty or unitPrice changes
        if (field === "quantity" || field === "unitPrice") {
          const qty =
            parseFloat(field === "quantity" ? value : row.quantity) || 0;
          const price =
            parseFloat(field === "unitPrice" ? value : row.unitPrice) || 0;
          updated.lineTotal = (qty * price).toFixed(2);
        }
        return updated;
      })
    );
  }

  function handleDeleteRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleAddRow() {
    setRows((prev) => [...prev, makeRow(defaultAssigneeIds)]);
  }

  function handleToggleAssignee(rowId: string, personId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const has = row.assigneeIds.includes(personId);
        return {
          ...row,
          assigneeIds: has
            ? row.assigneeIds.filter((id) => id !== personId)
            : [...row.assigneeIds, personId],
        };
      })
    );
  }

  function handleToggleRowSelect(rowId: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (rows.every((r) => selectedRowIds.has(r.id))) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(rows.map((r) => r.id)));
    }
  }

  function handleBulkToggle(personId: string) {
    const selected = rows.filter((r) => selectedRowIds.has(r.id));
    const allHave = selected.every((r) => r.assigneeIds.includes(personId));
    setRows((prev) =>
      prev.map((row) => {
        if (!selectedRowIds.has(row.id)) return row;
        if (allHave) {
          return {
            ...row,
            assigneeIds: row.assigneeIds.filter((id) => id !== personId),
          };
        }
        if (row.assigneeIds.includes(personId)) return row;
        return { ...row, assigneeIds: [...row.assigneeIds, personId] };
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const hasUnassigned = rows.some((r) => r.assigneeIds.length === 0);
  const canSave =
    rows.length > 0 && !hasUnassigned && !!payerId && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);

    // Build the exact ITEMIZED body (all money in cents)
    const payload = {
      type: "ITEMIZED" as const,
      ...(store.trim() ? { store: store.trim() } : {}),
      ...(purchasedAt ? { purchasedAt } : {}),
      tags,
      payerId,
      taxCents: toCents(parseFloat(taxDollars) || 0),
      items: rows.map((row) => ({
        name: row.name.trim() || "Item",
        ...(row.rawName ? { rawName: row.rawName } : {}),
        quantity: parseFloat(row.quantity) || 1,
        unitPriceCents: toCents(parseFloat(row.unitPrice) || 0),
        lineTotalCents: toCents(parseFloat(row.lineTotal) || 0),
        assigneeIds: row.assigneeIds,
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
  // Splitwise copy summary
  // ---------------------------------------------------------------------------

  function computeSummary(): string {
    if (!rows.length || hasUnassigned || !payerId) return "";
    try {
      const result = splitItemized({
        items: rows.map((r) => ({
          id: r.id,
          lineTotalCents: toCents(parseFloat(r.lineTotal) || 0),
          assigneeIds: r.assigneeIds,
        })),
        taxCents: toCents(parseFloat(taxDollars) || 0),
      });
      const payerPerson = people.find((p) => p.id === payerId);
      const storeName = store.trim() || "Receipt";
      const header = `${storeName} — ${formatUSD(result.totalCents)} (paid by ${payerPerson?.name ?? "?"})`;
      const lines = result.perPerson
        .filter((pp) => pp.personId !== payerId)
        .map((pp) => {
          const person = people.find((p) => p.id === pp.personId);
          return `${person?.name ?? "?"} owes ${payerPerson?.name ?? "?"} ${formatUSD(pp.cents)}`;
        });
      return [header, ...lines].join("\n");
    } catch {
      return "";
    }
  }

  const copySummary = computeSummary();

  // ---------------------------------------------------------------------------
  // Render
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

  return (
    <div className="space-y-6 pb-16">
      {/* Page heading */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {editId ? "Edit itemized expense" : "New itemized expense"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {editId
            ? "Saving clears “logged to Splitwise” so you remember to update it there."
            : "Upload a receipt photo to auto-fill items, or enter them manually."}
        </p>
      </div>

      {/* No people state */}
      {!peopleLoading && people.length === 0 && (
        <Card padding="lg">
          <div className="text-center space-y-4">
            <p className="text-sm text-ink">
              Add roommates first — you need at least one person to split an expense with.
            </p>
            <Link href="/people">
              <Button variant="primary">Add roommates</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* ── PHOTO STEP ──────────────────────────────────────────────────── */}
      {step === "photo" && (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div
              className="w-16 h-16 rounded-xl bg-canvas border border-rim flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-ink-muted"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>

            <div>
              <p className="text-sm font-medium text-ink">Upload a receipt</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Photo or image file — Gemini will extract items automatically
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="w-full"
              >
                {parsing ? "Parsing receipt…" : "Upload receipt photo"}
              </Button>

              {/* Hidden file input — capture="environment" opens camera on mobile */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Upload receipt image"
              />

              <button
                type="button"
                onClick={enterManually}
                disabled={parsing}
                className="text-sm text-ink-muted hover:text-ink underline underline-offset-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                Enter manually instead
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── TABLE STEP ──────────────────────────────────────────────────── */}
      {step === "table" && (
        <>
          {/* Parse error banner (non-blocking — user can still edit manually) */}
          {parseError && (
            <div
              className="flex items-start gap-3 text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3"
              role="alert"
            >
              <span className="flex-1">
                Could not parse receipt: {parseError}. You can still enter
                items manually below.
              </span>
            </div>
          )}

          {/* Parse warnings (non-blocking) */}
          {parseWarnings.length > 0 && (
            <div className="space-y-1.5" role="status">
              {parseWarnings.map((w) => (
                <div
                  key={w}
                  className="text-xs text-ink-muted bg-canvas border border-rim rounded-md px-3 py-2"
                >
                  Note: {w}
                </div>
              ))}
            </div>
          )}

          {/* Store + Date */}
          <Card padding="md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Store / vendor" htmlFor="store-input">
                <Input
                  id="store-input"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  placeholder="e.g. Walmart"
                />
              </Field>
              <Field label="Date" htmlFor="date-input">
                <Input
                  id="date-input"
                  type="date"
                  value={purchasedAt}
                  onChange={(e) => setPurchasedAt(e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tags" hint="Click to add or remove. Manage the list on the Tags page.">
                  <TagPicker value={tags} onChange={setTags} />
                </Field>
              </div>
            </div>
          </Card>

          {/* Payer selector */}
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

          {/* Item table */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-ink mb-4">Items</h2>

            {/* Bulk assign bar — visible when ≥1 row selected */}
            {selectedRowIds.size > 0 && (
              <div className="mb-3">
                <BulkAssignBar
                  selectedRowIds={selectedRowIds}
                  rows={rows}
                  people={people}
                  onBulkToggle={handleBulkToggle}
                  onClearSelection={() => setSelectedRowIds(new Set())}
                />
              </div>
            )}

            <ItemTable
              rows={rows}
              people={people}
              selectedRowIds={selectedRowIds}
              parsedTotal={parsedTotal}
              taxDollars={taxDollars}
              onTaxChange={setTaxDollars}
              onRowChange={handleRowChange}
              onDeleteRow={handleDeleteRow}
              onAddRow={handleAddRow}
              onToggleAssignee={handleToggleAssignee}
              onToggleRowSelect={handleToggleRowSelect}
              onToggleSelectAll={handleToggleSelectAll}
            />
          </Card>

          {/* Live breakdown */}
          <BreakdownCard
            items={rows.map((r) => ({
              id: r.id,
              lineTotal: r.lineTotal,
              assigneeIds: r.assigneeIds,
            }))}
            taxDollars={taxDollars}
            people={people}
            payerId={payerId}
          />

          {/* Validation messages */}
          {hasUnassigned && (
            <p
              className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
              role="alert"
            >
              Every item must have at least one person assigned before saving.
            </p>
          )}

          {saveError && (
            <p
              className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2"
              role="alert"
            >
              {saveError}
            </p>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              {saving ? "Saving…" : editId ? "Save changes" : "Save expense"}
            </Button>

            <CopyButton summary={copySummary} disabled={!copySummary} />

            {editId ? (
              <Link href={`/expenses/${editId}`}>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("photo")}
              >
                ← Back to photo
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
