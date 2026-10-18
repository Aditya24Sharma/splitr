import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface CopyButtonProps {
  /** Pre-formatted Splitwise-ready text. Pass an empty string to disable. */
  summary: string;
  disabled?: boolean;
}

/**
 * Copies a Splitwise-ready summary to the clipboard.
 * Generic: accepts pre-formatted text as a prop so it can be reused anywhere.
 */
export function CopyButton({ summary, disabled }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-HTTPS or user denied)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      disabled={disabled || !summary}
    >
      {copied ? "Copied!" : "Copy for Splitwise"}
    </Button>
  );
}
