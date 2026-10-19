import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";

interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

/** Pulls new transactions from Plaid (one bank, or all of them). */
export function SyncButton({
  itemId,
  label = "Sync",
  variant = "secondary",
  onSynced,
}: {
  itemId?: number;
  label?: string;
  variant?: ButtonVariant;
  onSynced: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(itemId != null ? `/api/plaid/sync/${itemId}` : "/api/plaid/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { results?: SyncResult[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Sync failed (HTTP ${res.status})`);
      const added = (data.results ?? []).reduce((s, r) => s + r.added, 0);
      setStatus({ ok: true, text: added === 0 ? "Up to date" : `${added} new` });
      onSynced();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant={variant} size="sm" onClick={sync} disabled={busy}>
        <span aria-hidden="true" className={busy ? "inline-block animate-spin" : ""}>↻</span>
        {busy ? "Syncing…" : label}
      </Button>
      {status && (
        <span role="status" className={`text-sm ${status.ok ? "text-ink-muted" : "text-danger font-semibold"}`}>
          {status.text}
        </span>
      )}
    </span>
  );
}
