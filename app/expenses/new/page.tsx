import Link from "next/link";

const CHOICES = [
  {
    href: "/expenses/new/simple",
    title: "Quick split",
    body: "One total, split evenly or by exact amounts. Gas, dinners, tickets.",
    color: "bg-sky",
  },
  {
    href: "/expenses/new/itemized",
    title: "Receipt",
    body: "Snap or type a store receipt, then pick who shares each item.",
    color: "bg-lavender",
  },
] as const;

export default function NewExpensePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-6xl sm:text-7xl uppercase">New expense</h1>
        <p className="mt-3 text-sm text-ink-muted">What are you splitting?</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CHOICES.map((c) => (
          <Link
            key={c.href}
            href={c.href}
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
                className="shrink-0 w-11 h-11 rounded-full bg-ink text-white inline-flex items-center justify-center text-xl transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
