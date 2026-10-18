/**
 * PersonChip — avatar (initials on colorHex background) + name label.
 *
 * Selected state: 2px accent ring + accent-tinted background.
 * Deliberately avoids colored dots, glow effects, and uppercase labels.
 */

interface PersonChipProps {
  name: string;
  colorHex: string;
  selected?: boolean;
  onClick?: () => void;
  /** 'sm' for inline assignment lists; 'md' (default) for management views */
  size?: "sm" | "md";
  /** When true the chip renders as a non-interactive span */
  readOnly?: boolean;
}

function readableText(hex: string): string {
  const m = hex.replace("#", "").replace(/^#/, "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // Guard against malformed/short hex that yields NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#ffffff";
  // Perceived luminance; threshold ~150 works well for these swatches
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1a1a1a" : "#ffffff";
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PersonChip({
  name,
  colorHex,
  selected = false,
  onClick,
  size = "md",
  readOnly = false,
}: PersonChipProps) {
  const initials = getInitials(name);

  const avatarClasses =
    size === "sm"
      ? "w-5 h-5 rounded text-[9px]"
      : "w-7 h-7 rounded-md text-[11px]";

  const chipPadding = size === "sm" ? "px-2 py-1 gap-1.5" : "px-2.5 py-1.5 gap-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const baseClasses = [
    "inline-flex items-center border font-medium transition-all",
    "rounded-lg",
    chipPadding,
    textSize,
    selected
      ? "border-accent bg-accent-dim text-accent ring-2 ring-accent/20 ring-offset-1 ring-offset-surface"
      : "border-rim bg-surface text-ink hover:border-rim-strong hover:bg-canvas",
    !readOnly ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const avatar = (
    <span
      className={`${avatarClasses} flex items-center justify-center font-semibold flex-shrink-0 leading-none`}
      style={{ backgroundColor: colorHex, color: readableText(colorHex) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );

  const label = <span className="leading-none">{name}</span>;

  if (readOnly) {
    return (
      <span className={baseClasses}>
        {avatar}
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${name}${selected ? " (selected)" : ""}`}
      className={baseClasses}
    >
      {avatar}
      {label}
    </button>
  );
}
