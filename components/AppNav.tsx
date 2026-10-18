"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Expenses", href: "/" },
  { label: "People", href: "/people" },
  { label: "Tags", href: "/tags" },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-ink">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display text-[28px] uppercase text-ink shrink-0"
          aria-label="Splitr home"
        >
          Splitr
        </Link>

        {/* Sections */}
        <nav className="flex items-center gap-1 flex-1 min-w-0" aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href }) => {
            const active =
              href === "/"
                ? pathname === "/" ||
                  (pathname.startsWith("/expenses/") && !pathname.startsWith("/expenses/new"))
                : pathname === href || pathname.startsWith(href + "/");

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
          className="shrink-0 inline-flex items-center gap-1 h-9 px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          New
        </Link>
      </div>
    </header>
  );
}
