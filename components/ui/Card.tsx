import { HTMLAttributes } from "react";

type Padding = "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
}

const PADDING_CLASSES: Record<Padding, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5 sm:p-6",
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
        "bg-surface border border-rim rounded-xl",
        PADDING_CLASSES[padding],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
