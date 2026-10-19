import Link from "@/components/Link";
import { Button } from "@/components/ui/Button";

/** Save / Cancel pinned to the bottom of long forms, with a one-line summary. */
export function SaveBar({
  summary,
  saveLabel,
  canSave,
  saving,
  onSave,
  cancelHref,
  children,
}: {
  summary: React.ReactNode;
  saveLabel: string;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  cancelHref: string;
  /** Extra buttons shown before Cancel */
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30">
      <div className="flex items-center gap-2 flex-wrap rounded-3xl sm:rounded-full border border-ink bg-surface px-3 py-2.5 shadow-[0_6px_0_0_#0B0B0C]">
        <p className="pl-2 mr-auto text-sm min-w-0 truncate">{summary}</p>
        {/* Kept together, so on a narrow screen they wrap as one group on the right */}
        <div className="ml-auto flex items-center gap-2">
          {children}
          <Link href={cancelHref}>
            <Button variant="ghost" size="sm">Cancel</Button>
          </Link>
          <Button variant="primary" onClick={onSave} disabled={!canSave}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
