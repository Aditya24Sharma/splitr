import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

// ---------------------------------------------------------------------------
// Field — label + slot wrapper
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-ink leading-none"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-ink-faint">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ hasError, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          "w-full px-3 py-2 h-9 text-sm bg-surface text-ink rounded-lg border",
          "placeholder:text-ink-faint",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent",
          "disabled:opacity-50 disabled:bg-canvas",
          hasError ? "border-danger" : "border-rim",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError, className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          "w-full px-3 py-2 text-sm bg-surface text-ink rounded-lg border",
          "placeholder:text-ink-faint resize-none",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent",
          "disabled:opacity-50 disabled:bg-canvas",
          hasError ? "border-danger" : "border-rim",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
