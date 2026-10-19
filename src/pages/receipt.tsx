import { useState, useEffect } from "react";
import { toast } from "sonner";
import { txLabel, type TxView } from "@/lib/transactions";
import { loadExpenseToEdit, loadSourceTx, peopleQuery, queryClient, useRefreshAll } from "../queries";
import { BackLink } from "@/components/BackLink";
import Link, { useGoTo, useQueryString } from "@/components/Link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ItemTable, type ItemRow } from "@/components/ItemTable";
import { BulkAssignBar } from "@/components/BulkAssignBar";
import { BreakdownCard } from "@/components/BreakdownCard";
import { CopyButton } from "@/components/CopyButton";
import { TagPicker } from "@/components/TagPicker";
import { PersonChip } from "@/components/PersonChip";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/ui/Section";
import { toCents, formatUSD } from "@/lib/money";
import { splitItemized } from "@/lib/split";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Person {
  id: string;
  name: string;
  colorHex: string;
  isDefault: boolean;
  isMe: boolean;
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

export default function NewItemizedPage() {
  // ?edit=<id> opens this form pre-filled to edit a saved expense;
  // ?fromTx=<id> pre-fills it from a charge in Money and links the two
  const { edit: editId, fromTx } = useQueryString<{ edit?: string; fromTx?: string }>();
  const goTo = useGoTo();
  const refreshAll = useRefreshAll();
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [sourceTx, setSourceTx] = useState<TxView | null>(null);

  // People
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);

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

  // ---------------------------------------------------------------------------
  // Load people
  // ---------------------------------------------------------------------------

  // peopleLoading starts true, so the effect only has to settle it
  useEffect(() => {
    Promise.all([
      queryClient.fetchQuery(peopleQuery),
      editId ? loadExpenseToEdit<SavedExpense>(editId) : null,
      fromTx && !editId ? loadSourceTx(fromTx) : null,
    ])
      .then(([data, saved, tx]) => {
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
          return;
        }
        if (tx) {
          setSourceTx(tx);
          setStore(txLabel(tx));
          setPurchasedAt(tx.date);
        }
        // A charge from Money is yours, so you paid
        const def = (tx && data.find((p) => p.isMe)) || data.find((p) => p.isDefault) || data[0];
        if (def) setPayerId(def.id);
        // Start with one empty item, shared by the usual people
        setRows([makeRow(data.filter((p) => p.isDefault || (tx && p.isMe)).map((p) => p.id))]);
      })
      .catch((err) => {
        if (editId || fromTx) {
          setEditLoadError(err instanceof Error ? err.message : "Couldn't load the expense.");
        }
      })
      .finally(() => setPeopleLoading(false));
  }, [editId, fromTx]);

  // Derived: IDs of default (roommate) people — used as initial assignees.
  // On your own charge you're in on every item too, unless you untick yourself.
  const defaultAssigneeIds = people
    .filter((p) => p.isDefault || (sourceTx && p.isMe))
    .map((p) => p.id);

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

    // Build the exact ITEMIZED body (all money in cents)
    const payload = {
      type: "ITEMIZED" as const,
      ...(store.trim() ? { store: store.trim() } : {}),
      ...(purchasedAt ? { purchasedAt } : {}),
      tags,
      payerId,
      ...(sourceTx && { transactionId: sourceTx.id }),
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
        refreshAll();
        goTo(`/expenses/${id}`);
        return;
      }

      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ?? `Server error ${res.status}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed. Try again.");
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
          className="text-sm text-danger bg-danger-dim border border-danger rounded-3xl px-5 py-4"
          role="alert"
        >
          {editLoadError}
        </p>
        <Link href={editId ? `/expenses/${editId}` : fromTx ? `/transactions/${fromTx}` : "/splits"}>
          <Button variant="secondary">{editId ? "Back to expense" : "Back"}</Button>
        </Link>
      </div>
    );
  }

  if (!peopleLoading && people.length === 0) {
    return (
      <div className="rounded-3xl border border-ink bg-sky px-6 py-12 text-center">
        <p className="font-display text-4xl uppercase">Add people first</p>
        <p className="mt-3 text-sm text-ink-muted">
          You need at least one person to split a receipt with.
        </p>
        <Link href="/people" className="inline-block mt-6">
          <Button variant="primary">Add people</Button>
        </Link>
      </div>
    );
  }

  const itemsTotalCents =
    rows.reduce((sum, r) => sum + toCents(parseFloat(r.lineTotal) || 0), 0) +
    toCents(parseFloat(taxDollars) || 0);

  return (
    <div className="space-y-9">
      <header>
        <BackLink href={editId ? `/expenses/${editId}` : fromTx ? `/expenses/new?fromTx=${fromTx}` : "/expenses/new"} label={editId ? "Back to expense" : fromTx ? "Back to split options" : "Back to New"} />
        <h1 className="mt-4 font-display text-6xl sm:text-7xl uppercase">
          {editId ? "Edit receipt" : "Receipt"}
        </h1>
        {editId && (
          <p className="mt-3 text-sm text-ink-muted">
            Saving clears &ldquo;logged to Splitwise&rdquo; so you remember to update it there.
          </p>
        )}
        {sourceTx && (
          <p className="mt-3 text-sm text-ink-muted">
            For your <span className="font-semibold text-ink tabular-nums">{formatUSD(sourceTx.amount)}</span>{" "}
            charge. Your share comes off what you spent in Money.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-4">
        <Field label="Store" htmlFor="store-input">
          <Input
            id="store-input"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Walmart, Costco…"
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
      </div>

      <Section title="Who paid">
        {peopleLoading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who paid">
            {people.map((p) => (
              <PersonChip
                key={p.id}
                name={p.name}
                colorHex={p.colorHex}
                selected={payerId === p.id}
                onClick={() => setPayerId(p.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Items · ${rows.length}`} hint="Tap people under each item to say who shares it.">
        {selectedRowIds.size > 0 && (
          <BulkAssignBar
            selectedRowIds={selectedRowIds}
            rows={rows}
            people={people}
            onBulkToggle={handleBulkToggle}
            onClearSelection={() => setSelectedRowIds(new Set())}
          />
        )}
        <ItemTable
          rows={rows}
          people={people}
          selectedRowIds={selectedRowIds}
          taxDollars={taxDollars}
          onTaxChange={setTaxDollars}
          onRowChange={handleRowChange}
          onDeleteRow={handleDeleteRow}
          onAddRow={handleAddRow}
          onToggleAssignee={handleToggleAssignee}
          onToggleRowSelect={handleToggleRowSelect}
          onToggleSelectAll={handleToggleSelectAll}
        />
      </Section>

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

      <Section title="Tags" hint="Optional. Manage the list on the Tags page.">
        <TagPicker value={tags} onChange={setTags} />
      </Section>

      <SaveBar
        summary={
          <>
            <span className="font-semibold tabular-nums">{formatUSD(itemsTotalCents)}</span>
            {sourceTx ? (
              <span
                className={
                  itemsTotalCents === sourceTx.amount ? "text-ink-muted" : "text-danger font-semibold"
                }
              >
                {itemsTotalCents === sourceTx.amount
                  ? " · matches the charge"
                  : ` of ${formatUSD(sourceTx.amount)} charge`}
              </span>
            ) : (
              <span className="text-ink-muted">
                {" "}· {rows.length} item{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </>
        }
        saveLabel={editId ? "Save changes" : "Save"}
        canSave={canSave}
        saving={saving}
        onSave={handleSave}
        cancelHref={editId ? `/expenses/${editId}` : fromTx ? `/transactions/${fromTx}` : "/splits"}
      >
        <span className="hidden sm:inline-flex">
          <CopyButton summary={copySummary} disabled={!copySummary} />
        </span>
      </SaveBar>
    </div>
  );
}
