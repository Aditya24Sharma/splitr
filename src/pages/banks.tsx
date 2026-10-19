import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountsQuery, useRefreshAll } from "../queries";
import { Button } from "@/components/ui/Button";
import { BankLogo } from "@/components/BankLogo";
import { SyncButton, type SyncResult } from "@/components/SyncButton";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { formatUSD } from "@/lib/money";
import { netBalance } from "@/lib/spending";
import { lastSynced, timeAgo, type BankItem } from "@/lib/bank-types";

export default function BanksPage() {
  const { data, error: loadError } = useQuery(accountsQuery);
  const refreshAll = useRefreshAll();
  const [notice, setNotice] = useState<string | null>(null);
  // Banks whose last sync said to sign in again. Kept until they sync cleanly.
  const [needsLogin, setNeedsLogin] = useState<ReadonlySet<number>>(new Set());

  function onSynced(results: SyncResult[]) {
    setNeedsLogin((prev) => {
      const next = new Set(prev);
      for (const r of results) {
        if (r.error === "login_required") next.add(r.itemId);
        else next.delete(r.itemId);
      }
      return next;
    });
    refreshAll();
  }

  // Pull history right away so Money fills in without another click
  function syncAfterLink(done: string, retry: string) {
    fetch("/api/plaid/sync", { method: "POST" })
      .then((r) => r.json() as Promise<{ results?: SyncResult[] }>)
      .then((d) => {
        onSynced(d.results ?? []);
        setNotice(done);
      })
      .catch(() => setNotice(retry));
  }

  const items = data?.items ?? [];
  const allAccounts = items.flatMap((i) => i.accounts);
  const synced = lastSynced(items);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-6xl sm:text-7xl uppercase">Banks</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Linked through Plaid.
        </p>
      </header>

      {loadError && (
        <div
          className="flex items-center gap-3 text-sm text-danger bg-danger-dim border border-danger rounded-3xl px-5 py-4"
          role="alert"
        >
          <span className="flex-1">{loadError.message}</span>
          <Button variant="danger" size="sm" onClick={() => refreshAll()}>
            Retry
          </Button>
        </div>
      )}

      {!data && !loadError && <p className="text-sm text-ink-faint">Loading…</p>}

      {data && (
        <>
          {/* ── Net balance + actions ───────────────────────────────────── */}
          {items.length > 0 && (
            <div className="rounded-3xl border border-ink bg-lavender px-6 pt-4 pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.08em]">Net balance</p>
              <p className="mt-1 font-display text-7xl sm:text-8xl tabular-nums leading-none">
                {formatUSD(netBalance(allAccounts))}
              </p>
              {synced && <p className="mt-3 text-sm text-ink-muted">Updated {timeAgo(synced)}</p>}
            </div>
          )}

          <div className="flex items-start gap-2 flex-wrap">
            {data.plaidConfigured ? (
              <PlaidLinkButton
                variant={items.length > 0 ? "secondary" : "primary"}
                onLinked={(name, reconnected) => {
                  if (reconnected) {
                    setNotice("Reconnected. Syncing…");
                    syncAfterLink("Reconnected.", "Reconnected. Sync again in a minute.");
                    return;
                  }
                  setNotice(`Linked ${name ?? "your bank"}. Syncing its transactions…`);
                  refreshAll();
                  syncAfterLink(
                    `Linked ${name ?? "your bank"}.`,
                    `Linked ${name ?? "your bank"}. Sync again in a minute to pull its history.`
                  );
                }}
              />
            ) : (
              <p className="text-sm rounded-2xl border border-ink bg-sun/40 px-4 py-2.5">
                Plaid isn’t set up. Add your keys to <code className="font-mono">.env.local</code> (see{" "}
                <code className="font-mono">.env.example</code>) and restart the app.
              </p>
            )}
            {items.length > 1 && (
              <SyncButton label="Sync all" size="md" onSynced={onSynced} />
            )}
          </div>
          {notice && (
            <p role="status" className="text-sm rounded-2xl bg-mint-dim border border-mint px-4 py-2.5">
              {notice}
            </p>
          )}

          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink px-6 py-10 text-center">
              <p className="font-display text-3xl uppercase">No banks yet</p>
              <p className="mt-3 text-sm text-ink-muted">
                Link a bank or card and its charges land in Money, ready to split.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item, i) => (
                <BankCard
                  key={item.id}
                  item={item}
                  index={i}
                  needsLogin={needsLogin.has(item.id)}
                  onChange={refreshAll}
                  onSynced={onSynced}
                  onReconnected={() => {
                    setNotice(`Reconnected ${item.institutionName ?? "your bank"}. Syncing…`);
                    fetch(`/api/plaid/sync/${item.id}`, { method: "POST" })
                      .then((r) => r.json() as Promise<{ results?: SyncResult[] }>)
                      .then((d) => {
                        onSynced(d.results ?? []);
                        setNotice(`Reconnected ${item.institutionName ?? "your bank"}.`);
                      })
                      .catch(() => setNotice("Reconnected. Sync again in a minute."));
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BankCard({
  item,
  index,
  needsLogin,
  onChange,
  onSynced,
  onReconnected,
}: {
  item: BankItem;
  index: number;
  needsLogin: boolean;
  onChange: () => void;
  onSynced: (results: SyncResult[]) => void;
  onReconnected: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = item.institutionName ?? "Linked bank";

  async function unlink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plaid/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlink failed");
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <section
      className="rise rounded-3xl border border-ink overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      aria-label={name}
    >
      <div className="flex items-center gap-3 px-5 py-3.5 bg-mist border-b border-ink flex-wrap">
        <BankLogo item={item} />
        <h2 className="font-semibold mr-auto">{name}</h2>
        {confirm ? (
          <span className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">Unlink and delete its transactions?</span>
            <Button variant="danger" size="sm" onClick={unlink} disabled={busy}>
              {busy ? "Unlinking…" : "Unlink"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            {needsLogin && (
              <PlaidLinkButton itemId={item.id} size="sm" onLinked={onReconnected} />
            )}
            <SyncButton itemId={item.id} variant="ghost" onSynced={onSynced} />
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
              Unlink
            </Button>
          </span>
        )}
      </div>
      {error && (
        <p className="px-5 py-2 text-sm text-danger bg-danger-dim" role="alert">
          {error}
        </p>
      )}
      {item.accounts.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-muted">No accounts yet. Sync to fetch them.</p>
      ) : (
        <ul className="divide-y divide-rim">
          {item.accounts.map((a) => {
            const owed = a.type === "credit" || a.type === "loan";
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-xs text-ink-muted capitalize">
                    {a.subtype ?? a.type}
                    {a.mask ? ` •• ${a.mask}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl tabular-nums">
                    {a.currentBalance == null ? "—" : formatUSD(a.currentBalance)}
                  </p>
                  {owed && a.currentBalance != null && a.currentBalance > 0 && (
                    <p className="text-xs text-ink-muted">owed</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
