"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "People", href: "/people" },
  { label: "New expense", href: "/expenses/new" },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-rim">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-display italic text-xl font-semibold text-ink shrink-0 tracking-tight"
          aria-label="Splitr home"
        >
          Splitr
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 flex-1 min-w-0" aria-label="Main navigation">
          {NAV_LINKS.map(({ label, href }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-accent-dim text-accent font-semibold"
                    : "text-ink-muted hover:text-ink hover:bg-canvas",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
