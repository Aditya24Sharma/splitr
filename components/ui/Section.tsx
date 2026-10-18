/** A labelled group of form fields: small uppercase title, optional hint. */
export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
