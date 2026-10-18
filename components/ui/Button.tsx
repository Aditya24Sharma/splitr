import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white border-transparent hover:bg-accent-hover focus-visible:ring-accent/40",
  secondary:
    "bg-surface text-ink border-rim hover:bg-canvas focus-visible:ring-ink/20",
  ghost:
    "bg-transparent text-ink-muted border-transparent hover:bg-canvas hover:text-ink focus-visible:ring-ink/20",
  danger:
    "bg-danger-dim text-danger border-danger/20 hover:bg-danger/10 focus-visible:ring-danger/30",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-md h-8",
  md: "px-4 py-2 text-sm rounded-lg h-9",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      className = "",
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center gap-1.5 border font-medium",
          "transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:pointer-events-none",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
