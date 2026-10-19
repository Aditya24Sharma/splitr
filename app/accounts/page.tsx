"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BankLogo } from "@/components/BankLogo";
import { SyncButton } from "@/components/SyncButton";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { formatUSD } from "@/lib/money";
import { netBalance } from "@/lib/spending";
import { lastSynced, timeAgo, type AccountsResponse, type BankItem } from "@/lib/bank-types";

async function fetchBanks(): Promise<AccountsResponse> {
  const res = await fetch("/api/accounts");
  if (!res.ok) throw new Error(`Failed to load banks (HTTP ${res.status})`);
  return res.json() as Promise<AccountsResponse>;
}

export default function BanksPage() {
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => fetchBanks().then(setData), []);

  useEffect(() => {
    fetchBanks()
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn’t load banks."));
  }, []);

  const items = data?.items ?? [];
  const allAccounts = items.flatMap((i) => i.accounts);
  const synced = lastSynced(items);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-6xl sm:text-7xl uppercase">Banks</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Linked through Plaid. Syncing pulls new charges into Money.
        </p>
      </header>

      {loadError && (
        <div
          className="flex items-center gap-3 text-sm text-danger bg-danger-dim border border-danger rounded-3xl px-5 py-4"
          role="alert"
        >
          <span className="flex-1">{loadError}</span>
          <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
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
              <p className="mt-3 text-sm">
                What you have minus what you owe on cards and loans
                {synced && <span className="text-ink-muted"> · updated {timeAgo(synced)}</span>}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 flex-wrap">
            {data.plaidConfigured ? (
              <PlaidLinkButton
                variant={items.length > 0 ? "secondary" : "primary"}
                onLinked={(name) => {
                  setNotice(`Linked ${name ?? "your bank"}. Syncing its transactions…`);
                  reload().catch(() => {});
                  // Pull history right away so Money fills in without another click
                  fetch("/api/plaid/sync", { method: "POST" })
                    .then(() => reload())
                    .then(() => setNotice(`Linked ${name ?? "your bank"}.`))
                    .catch(() => setNotice(`Linked ${name ?? "your bank"}. Sync again in a minute to pull its history.`));
                }}
              />
            ) : (
              <p className="text-sm rounded-2xl border border-ink bg-sun/40 px-4 py-2.5">
                Plaid isn’t set up. Add your keys to <code className="font-mono">.env.local</code> (see{" "}
                <code className="font-mono">.env.example</code>) and restart the app.
              </p>
            )}
            {items.length > 1 && (
              <SyncButton label="Sync all" onSynced={() => reload().catch(() => {})} />
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
                <BankCard key={item.id} item={item} index={i} onChange={() => reload().catch(() => {})} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BankCard({ item, index, onChange }: { item: BankItem; index: number; onChange: () => void }) {
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
            <SyncButton itemId={item.id} variant="ghost" onSynced={onChange} />
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
