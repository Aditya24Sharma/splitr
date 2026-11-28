import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { groupsQuery, useRefreshAll, type Group, type Person } from "@/src/queries";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PersonChip } from "@/components/PersonChip";

// Groups on the People page: name a set of people (a trip, say) once, then
// pick it in one tap when starting a split. You're in every split anyway, so
// you aren't offered as a member.

const NO_GROUPS: Group[] = [];

/** Sends a group save or delete; throws the API's error message on failure. */
async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  }
}

function GroupForm({
  people,
  initial,
  onDone,
}: {
  people: Person[];
  /** The group being edited; omit to create one */
  initial?: Group;
  onDone: () => void;
}) {
  const refreshAll = useRefreshAll();
  const [name, setName] = useState(initial?.name ?? "");
  const [memberIds, setMemberIds] = useState<Set<string>>(() => new Set(initial?.memberIds ?? []));
  const [saving, setSaving] = useState(false);
  // Only people still listed can be members; archived ones drop off on save
  const picked = people.filter((p) => memberIds.has(p.id));
  const canSave = name.trim() !== "" && picked.length > 0 && !saving;

  function toggle(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), memberIds: picked.map((p) => p.id) };
      await send(initial ? `/api/groups/${initial.id}` : "/api/groups", initial ? "PUT" : "POST", body);
      await refreshAll();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t save the group.");
    } finally {
      setSaving(false);
    }
  }

  const nameId = `group-name-${initial?.id ?? "new"}`;
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field label="Group name" htmlFor={nameId}>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tahoe trip"
          autoFocus
        />
      </Field>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Who’s in it</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {people.map((p) => (
            <PersonChip
              key={p.id}
              name={p.name}
              colorHex={p.colorHex}
              selected={memberIds.has(p.id)}
              onClick={() => toggle(p.id)}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!canSave}>
          {saving ? "Saving…" : initial ? "Save" : "Create group"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function GroupsSection({ people }: { people: Person[] }) {
  const groupsResult = useQuery(groupsQuery);
  const groups = groupsResult.data ?? NO_GROUPS;
  const refreshAll = useRefreshAll();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // You're in every split, so you're never a member you have to pick
  const choices = people.filter((p) => !p.isMe);
  const byId = new Map(people.map((p) => [p.id, p]));

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await send(`/api/groups/${id}`, "DELETE");
      setDeleteId(null);
      await refreshAll();
    } catch {
      toast.error("Couldn’t delete the group. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="groups-heading" className="space-y-4">
      <div>
        <h2 id="groups-heading" className="font-display text-3xl uppercase">
          Groups
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          For trips and other crews. Pick a group when you split and everyone in it is added. You’re always included.
        </p>
      </div>

      {groupsResult.error && (
        <p className="text-sm text-danger" role="alert">
          {groupsResult.error.message}
        </p>
      )}

      {groups.length > 0 && (
        <div className="rounded-3xl border border-ink divide-y divide-rim overflow-hidden">
          {groups.map((g) =>
            editingId === g.id ? (
              <div key={g.id} className="bg-mist p-5">
                <GroupForm people={choices} initial={g} onDone={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={g.id} className="px-5 py-3.5 bg-surface">
                <div className="flex items-center gap-3">
                  <p className="flex-1 min-w-0 font-semibold truncate">{g.name}</p>
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(g.id);
                        setDeleteId(null);
                        setCreating(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteId(g.id);
                        setEditingId(null);
                      }}
                      disabled={deleteId === g.id}
                      className="hover:!text-danger hover:!bg-danger-dim"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.memberIds
                    .map((id) => byId.get(id))
                    .filter((p): p is Person => p !== undefined)
                    .map((p) => (
                      <PersonChip key={p.id} name={p.name} colorHex={p.colorHex} size="sm" readOnly />
                    ))}
                </div>
                {deleteId === g.id && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="mr-auto text-sm text-ink-muted">
                      Delete this group? The people and past splits stay.
                    </span>
                    <span className="flex items-center gap-2">
                      <Button variant="danger" size="sm" onClick={() => handleDelete(g.id)} disabled={deleting}>
                        {deleting ? "Deleting…" : "Delete"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)} disabled={deleting}>
                        Cancel
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {creating ? (
        <div className="rounded-3xl border border-ink bg-sky p-6">
          <GroupForm people={choices} onDone={() => setCreating(false)} />
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          disabled={choices.length === 0}
        >
          New group
        </Button>
      )}
    </section>
  );
}
