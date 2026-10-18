import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function NewExpensePage() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          New expense
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Choose how you want to record this expense.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/expenses/new/itemized" className="group block">
          <Card
            padding="lg"
            className="h-full transition-colors hover:border-accent cursor-pointer"
          >
            <div className="space-y-2">
              <div
                className="w-10 h-10 rounded-lg bg-canvas border border-rim flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ink-muted"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-ink">
                Itemized receipt
              </h2>
              <p className="text-sm text-ink-muted">
                Scan or enter a Walmart / Sam&apos;s receipt and split per item.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/expenses/new/simple" className="group block">
          <Card
            padding="lg"
            className="h-full transition-colors hover:border-accent cursor-pointer"
          >
            <div className="space-y-2">
              <div
                className="w-10 h-10 rounded-lg bg-canvas border border-rim flex items-center justify-center"
                aria-hidden="true"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ink-muted"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-ink">
                Simple split
              </h2>
              <p className="text-sm text-ink-muted">
                Split a single total evenly or by exact amounts.
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
