import Link from "@/components/Link";

/**
 * The way back from a page: a round chevron button. The destination is in
 * the label, for screen readers and as a tooltip.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="tap-area inline-flex items-center justify-center w-10 h-10 rounded-full border border-ink bg-surface text-ink hover:bg-sun active:scale-95 transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.25">
        <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
