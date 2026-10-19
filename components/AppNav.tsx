import Link from "@/components/Link";
import { useRouterState } from "@tanstack/react-router";

// Each section also owns the detail pages under these prefixes
const NAV_LINKS = [
  { label: "Money", href: "/", owns: ["/transactions/"] },
  { label: "Splits", href: "/splits", owns: ["/expenses/"] },
  { label: "People", href: "/people", owns: [] },
  { label: "Tags", href: "/tags", owns: [] },
  { label: "Banks", href: "/accounts", owns: [] },
] as const;

function isActive(pathname: string, { href, owns }: (typeof NAV_LINKS)[number]): boolean {
  return (
    pathname === href ||
    (href !== "/" && pathname.startsWith(href + "/")) ||
    owns.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Adding or editing something, where the screen's own Save bar sits at the
 * bottom. Phones hide the tab bar here, like an app's create screens.
 */
function isFormScreen(pathname: string): boolean {
  return pathname.startsWith("/expenses/new") || pathname.startsWith("/transactions/new");
}

function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}

/** The top bar. Sections show here from tablet width up; phones get BottomTabs. */
export default function AppNav() {
  const pathname = usePathname();

  return (
    // On short screens (a phone on its side) it scrolls away instead of
    // staying pinned, leaving room for the page and its Save bar
    <header className="sticky [@media(max-height:500px)]:static top-0 z-40 bg-surface/90 backdrop-blur border-b border-ink pt-[env(safe-area-inset-top)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="tap-area font-display text-[28px] uppercase text-ink shrink-0"
          aria-label="Splitr home"
        >
          Splitr
        </Link>

        {/* Sections */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 min-w-0" aria-label="Main navigation">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "px-3 h-8 inline-flex items-center rounded-full text-sm font-semibold transition-colors whitespace-nowrap border",
                  active
                    ? "bg-sun border-ink text-ink"
                    : "border-transparent text-ink-muted hover:text-ink hover:bg-mist",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Primary action */}
        <Link
          href="/expenses/new"
          aria-label="New expense"
          className="ml-auto sm:ml-0 shrink-0 inline-flex items-center justify-center gap-1 h-9 px-4 rounded-full bg-ink text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          <span aria-hidden="true" className="text-base leading-none">+</span>
          <span>New</span>
        </Link>
      </div>
    </header>
  );
}

/** The sections along the bottom of a phone screen, within thumb reach. */
export function BottomTabs() {
  const pathname = usePathname();
  if (isFormScreen(pathname)) return null;

  return (
    <nav
      className="sm:hidden fixed inset-x-0 bottom-0 z-40 bg-surface/95 backdrop-blur border-t border-ink h-[var(--tabbar)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      aria-label="Main navigation"
    >
      <div className="h-full grid grid-cols-5 items-center gap-1 px-2">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "h-11 inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors border",
                active ? "bg-sun border-ink text-ink" : "border-transparent text-ink-muted active:bg-mist",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
