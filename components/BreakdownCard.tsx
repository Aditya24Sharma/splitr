"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { splitItemized } from "@/lib/split";
import { formatUSD, toCents } from "@/lib/money";

export interface BreakdownItem {
  id: string;
  /** Dollar amount as a string (e.g. "5.99") */
  lineTotal: string;
  assigneeIds: string[];
}

interface Person {
  id: string;
  name: string;
}

interface BreakdownCardProps {
  items: BreakdownItem[];
  /** Tax in dollars as a string (e.g. "4.23") */
  taxDollars: string;
  people: Person[];
  payerId: string;
}

/**
 * Live per-person breakdown computed via splitItemized.
 * Blocks save if any item has zero assignees (surfaced as an inline message).
 */
export function BreakdownCard({
  items,
  taxDollars,
  people,
  payerId,
}: BreakdownCardProps) {
  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const result = useMemo(() => {
    const taxCents = toCents(parseFloat(taxDollars) || 0);
    const unassigned = items.filter((it) => it.assigneeIds.length === 0);
    if (items.length === 0 || unassigned.length > 0) return null;
    try {
      return splitItemized({
        items: items.map((it) => ({
          id: it.id,
          lineTotalCents: toCents(parseFloat(it.lineTotal) || 0),
          assigneeIds: it.assigneeIds,
        })),
        taxCents,
      });
    } catch {
      return null;
    }
  }, [items, taxDollars]);

  const unassignedCount = items.filter((it) => it.assigneeIds.length === 0).length;
  const payer = personById.get(payerId);

  if (items.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-ink-faint text-center py-2">
          Add items to see the breakdown.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold text-ink mb-3">Breakdown</h3>

      {unassignedCount > 0 && (
        <p
          className="text-sm text-danger bg-danger-dim border border-danger/20 rounded-lg px-3 py-2 mb-3"
          role="alert"
        >
          {unassignedCount === 1
            ? "1 item has"
            : `${unassignedCount} items have`}{" "}
          no assignees — every item needs at least one person before saving.
        </p>
      )}

      {result && (
        <>
          {/* Per-person shares */}
          <div className="space-y-2">
            {result.perPerson.map(({ personId, cents }) => {
              const person = personById.get(personId);
              if (!person) return null;
              const isPayer = personId === payerId;
              return (
                <div
                  key={personId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink">
                    {person.name}
                    {isPayer && (
                      <span className="ml-1.5 text-xs font-medium text-ink-muted">
                        (payer)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-ink tabular-nums">
                    {formatUSD(cents)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-3 pt-3 border-t border-rim flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatUSD(result.totalCents)}</span>
          </div>

          {/* Settles-up section for non-payers */}
          {payer &&
            result.perPerson.filter((pp) => pp.personId !== payerId).length >
              0 && (
              <div className="mt-3 pt-3 border-t border-rim">
                <p className="text-xs font-medium text-ink-muted mb-2">
                  Settles up with {payer.name}
                </p>
                <div className="space-y-1.5">
                  {result.perPerson
                    .filter((pp) => pp.personId !== payerId)
                    .map(({ personId, cents }) => {
                      const person = personById.get(personId);
                      if (!person) return null;
                      return (
                        <div
                          key={personId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-ink-muted">{person.name}</span>
                          <span className="text-ink tabular-nums">
                            {formatUSD(cents)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </>
      )}
    </Card>
  );
}
