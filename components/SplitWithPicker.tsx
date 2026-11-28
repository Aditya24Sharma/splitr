import { useQuery } from "@tanstack/react-query";
import { PersonChip } from "@/components/PersonChip";
import { groupsQuery, type Person } from "@/src/queries";
import { groupSelection, isGroupPicked } from "@/lib/groups";

/**
 * Who's in a split. Tapping a group picks exactly its people plus you; tapping
 * a person adds or removes just them, so you can start from a group and adjust.
 */
export function SplitWithPicker({
  people,
  picked,
  onChange,
}: {
  people: Person[];
  picked: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const groups = useQuery(groupsQuery).data ?? [];
  const activeIds = new Set(people.map((p) => p.id));
  const meId = people.find((p) => p.isMe)?.id;

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Groups">
          {groups.map((g) => {
            const selected = isGroupPicked(g.memberIds, activeIds, meId, picked);
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(groupSelection(g.memberIds, activeIds, meId))}
                className={[
                  "h-9 px-4 rounded-full border border-ink text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sun",
                  selected ? "bg-ink text-white" : "bg-surface hover:bg-sun",
                ].join(" ")}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="People">
        {people.map((p) => (
          <PersonChip
            key={p.id}
            name={p.name}
            colorHex={p.colorHex}
            selected={picked.has(p.id)}
            onClick={() => toggle(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
