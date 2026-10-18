"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Each section also owns the detail pages under these prefixes
const NAV_LINKS = [
  { label: "Money", href: "/", owns: ["/transactions/"] },
  { label: "Splits", href: "/splits", owns: ["/expenses/"] },
  { label: "People", href: "/people", owns: [] },
  { label: "Tags", href: "/tags", owns: [] },
  { label: "Banks", href: "/accounts", owns: [] },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-ink">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-[28px] uppercase text-ink shrink-0"
          aria-label="Splitr home"
        >
          Splitr
        </Link>

        {/* Sections */}
        <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto" aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href, owns }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href + "/")) ||
              owns.some((prefix) => pathname.startsWith(prefix));

            return (
              <Link
                key={href}
                href={href}
                className={[
                  "px-3 h-8 inline-flex items-center rounded-full text-sm font-semibold transition-colors whitespace-nowrap border",
                  active
                    ? "bg-sun border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-mist",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Primary action */}
        <Link
          href="/expenses/new"
          aria-label="New expense"
          className="shrink-0 inline-flex items-center justify-center gap-1 h-9 w-9 sm:w-auto sm:px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          <span aria-hidden="true" className="text-lg sm:text-base leading-none">+</span>
          <span className="hidden sm:inline">New</span>
        </Link>
      </div>
    </header>
  );
}
