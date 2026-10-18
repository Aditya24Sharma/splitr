import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white border-ink hover:bg-accent-hover hover:border-accent-hover",
  secondary: "bg-surface text-ink border-ink hover:bg-sun",
  ghost:
    "bg-transparent text-ink-muted border-transparent hover:text-ink hover:bg-mist",
  danger: "bg-surface text-danger border-danger hover:bg-danger-dim",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-sm",
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
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
          "rounded-full border font-semibold transition-[background-color,color,transform] duration-150",
          "active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun",
          "disabled:opacity-40 disabled:pointer-events-none",
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
