import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Delete, at the foot of a page and away from the everyday actions, with a
 * second tap to confirm.
 */
export function DeleteSection({
  label,
  question,
  deleting,
  onDelete,
}: {
  /** e.g. "Delete split" */
  label: string;
  /** Asked before deleting, e.g. "Delete for good?" */
  question: string;
  deleting: boolean;
  /** Deletes and leaves the page; on failure the page shows a toast */
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-label={label} className="pt-6 border-t border-rim">
      {!confirming ? (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-muted">{question}</span>
          <Button
            variant="danger"
            size="sm"
            disabled={deleting}
            onClick={async () => {
              await onDelete();
              setConfirming(false);
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
}
