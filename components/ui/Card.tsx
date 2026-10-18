import { HTMLAttributes } from "react";

type Padding = "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
}

const PADDING_CLASSES: Record<Padding, string> = {
  sm: "p-3.5",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

export function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "bg-surface border border-ink rounded-3xl",
        PADDING_CLASSES[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
