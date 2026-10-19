import { useQuery } from "@tanstack/react-query";
import { accountsQuery, transactionQuery } from "../queries";
import { Chevron } from "@/components/Chevron";
import { BackLink } from "@/components/BackLink";
import Link, { useQueryString } from "@/components/Link";
import { formatUSD } from "@/lib/money";
import { accountLabel, indexAccounts } from "@/lib/bank-types";

const SPLIT_CHOICES = [
  {
    path: "/expenses/new/simple",
    title: "Quick split",
    body: "One total, split evenly or by exact amounts. Gas, dinners, tickets.",
    color: "bg-sky",
  },
  {
    path: "/expenses/new/itemized",
    title: "Receipt",
    body: "Type in a store receipt, then pick who shares each item.",
    color: "bg-lavender",
  },
] as const;

const JUST_ME = {
  path: "/transactions/new",
  title: "Just me",
  body: "Cash or anything your bank doesn’t see. Goes into Money, no split.",
  color: "bg-mint-dim",
} as const;

export default function NewExpensePage() {
  // ?fromTx=<id> splits a charge that's already in Money
  const { fromTx } = useQueryString<{ fromTx?: string }>();
  // The charge to split and its bank; a charge that can't be loaded falls
  // back to the plain chooser
  const txResult = useQuery({ ...transactionQuery(fromTx ?? ""), enabled: Boolean(fromTx) });
  const banksResult = useQuery({ ...accountsQuery, enabled: Boolean(fromTx) });

  if (txResult.isLoading || banksResult.isLoading) return <p className="text-sm text-ink-faint">Loading…</p>;

  const tx = txResult.data ?? null;
  const account = tx?.accountId != null ? indexAccounts(banksResult.data?.items ?? []).get(tx.accountId) : undefined;
  const choices = tx ? SPLIT_CHOICES : [JUST_ME, ...SPLIT_CHOICES];
  const query = tx ? `?fromTx=${tx.id}` : "";

  return (
    <div className="space-y-8">
      <header>
        {tx && (
          <BackLink href={`/transactions/${tx.id}`} label="Back to charge" />
        )}
        <h1 className={`${tx ? "mt-4 " : ""}font-display text-6xl sm:text-7xl uppercase`}>
          {tx ? "Split it" : "New"}
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {tx ? "How do you want to split it?" : "What are you adding?"}
        </p>
      </header>

      {tx && (
        <div className="rounded-3xl border border-ink bg-mist px-5 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{tx.merchantName || tx.name}</p>
            <p className="text-sm text-ink-muted truncate">
              {new Date(`${tx.date}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {accountLabel(account)}
            </p>
          </div>
          <p className="font-display text-4xl tabular-nums">{formatUSD(tx.amount)}</p>
        </div>
      )}

      {tx?.split ? (
        <div className="rounded-3xl border border-ink bg-sun/40 px-5 py-4 text-sm">
          This charge is already split.{" "}
          <Link href={`/expenses/${tx.split.expenseId}`} className="font-semibold underline underline-offset-4">
            Open the split
          </Link>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${choices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {choices.map((c) => (
            <Link
              key={c.path}
              href={c.path + (c.path === JUST_ME.path ? "" : query)}
              className={[
                "group rise block rounded-3xl border border-ink p-6 sm:p-7 min-h-52",
                "flex flex-col justify-between gap-8 transition-transform duration-200",
                "hover:-translate-y-1 hover:shadow-[0_6px_0_0_#0B0B0C]",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun",
                c.color,
              ].join(" ")}
            >
              <h2 className="font-display text-5xl uppercase">{c.title}</h2>
              <div className="flex items-end justify-between gap-4">
                <p className="text-sm max-w-[26ch]">{c.body}</p>
                <span
                  aria-hidden="true"
                  className="shrink-0 w-11 h-11 rounded-full bg-ink text-white inline-flex items-center justify-center transition-transform group-hover:translate-x-1"
                >
                  <Chevron direction="right" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
