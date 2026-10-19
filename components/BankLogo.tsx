import type { BankItem } from "@/lib/bank-types";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Round bank avatar: Plaid's logo when it has one, otherwise initials on the
 * bank's brand color. No item means a hand-added (cash) expense.
 */
export function BankLogo({ item, size = "md" }: { item?: BankItem | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "w-6 h-6 text-[9px]", md: "w-8 h-8 text-[10px]", lg: "w-11 h-11 text-xs" }[size];
  const base = `${box} shrink-0 rounded-full border border-ink overflow-hidden inline-flex items-center justify-center font-bold`;

  if (!item) {
    return (
      <span className={`${base} bg-mint-dim`} aria-label="Cash">
        $
      </span>
    );
  }
  const name = item.institutionName ?? "Bank";
  if (item.institutionLogo) {
    return (
      <span className={`${base} bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 from Plaid */}
        <img src={`data:image/png;base64,${item.institutionLogo}`} alt={name} className="w-full h-full object-contain p-1" />
      </span>
    );
  }
  return (
    <span className={`${base} text-white`} style={{ backgroundColor: item.institutionColor ?? "#55534E" }} aria-label={name}>
      {initials(name)}
    </span>
  );
}
