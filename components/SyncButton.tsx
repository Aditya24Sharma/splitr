import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

export interface SyncResult {
  itemId: number;
  institutionName: string | null;
  added: number;
  modified: number;
  removed: number;
  /** This bank failed; the others still synced. login_required: reconnect it on Banks. */
  error?: "login_required" | "failed";
}

/** "Chase", "Chase and Amex" */
function bankNames(results: SyncResult[]): string {
  return results.map((r) => r.institutionName ?? "a bank").join(" and ");
}

function syncStatus(results: SyncResult[]): { ok: boolean; text: string } {
  const login = results.filter((r) => r.error === "login_required");
  const failed = results.filter((r) => r.error === "failed");
  if (login.length > 0) return { ok: false, text: `${bankNames(login)} need${login.length === 1 ? "s" : ""} you to reconnect` };
  if (failed.length > 0) return { ok: false, text: `Couldn’t sync ${bankNames(failed)}` };
  const added = results.reduce((s, r) => s + r.added, 0);
  return { ok: true, text: added === 0 ? "Up to date" : `${added} new` };
}

/** Pulls new transactions from Plaid (one bank, or all of them). */
export function SyncButton({
  itemId,
  label = "Sync",
  variant = "secondary",
  size = "sm",
  onSynced,
}: {
  itemId?: number;
  label?: string;
  variant?: ButtonVariant;
  /** Match the button beside it */
  size?: ButtonSize;
  /** Also called when some banks failed; their results carry the error */
  onSynced: (results: SyncResult[]) => void;
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
      const results = data.results ?? [];
      setStatus(syncStatus(results));
      onSynced(results);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant={variant} size={size} onClick={sync} disabled={busy}>
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
