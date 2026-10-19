import { Chevron } from "@/components/Chevron";
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
      <Chevron direction="left" />
    </Link>
  );
}
