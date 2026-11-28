import Link from "@/components/Link";
import { Button } from "@/components/ui/Button";

/** Shown on a new split until one person is marked "This is me", since you pay for every split. */
export function MarkYourselfFirst() {
  return (
    <div className="rounded-3xl border border-ink bg-sky px-6 py-12 text-center">
      <p className="font-display text-4xl uppercase">Which one is you?</p>
      <p className="mt-3 text-sm text-ink-muted">
        You pay for every split. On People, edit yourself and tick &ldquo;This is me&rdquo;.
      </p>
      <Link href="/people" className="inline-block mt-6">
        <Button variant="primary">Go to People</Button>
      </Link>
    </div>
  );
}
