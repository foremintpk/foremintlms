"use client";

import { useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmAction } from "@/components/common/confirm-action";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/hooks/use-action";
import { initials } from "@/lib/format";
import { assignInstructor, removeInstructor, updateInstructor } from "@/lib/services/courses/actions/instructors";
import type { InstructorRow } from "@/lib/services/courses/builder";

export function InstructorsManager({
  courseId,
  rows,
  available,
}: {
  courseId: string;
  rows: InstructorRow[];
  available: { user_id: string; name: string; email: string | null }[];
}) {
  const [pick, setPick] = useState<string>("");
  const [role, setRole] = useState<"lead" | "assistant">(rows.length ? "assistant" : "lead");
  const assign = useAction(assignInstructor, { onSuccess: () => setPick("") });
  const update = useAction(updateInstructor);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-semibold">Add an instructor</h2>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every approved instructor is already assigned. Invite new instructors from Admin → Instructors.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="w-full" aria-label="Instructor">
                <SelectValue placeholder="Choose an approved instructor" />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.name}
                    {t.email ? ` · ${t.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => setRole(v as "lead" | "assistant")}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
            <Button disabled={!pick || assign.pending} onClick={() => void assign.run({ courseId, userId: pick, role, canEdit: true })}>
              {assign.pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Assign
            </Button>
          </div>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No instructors assigned" description="Assigned instructors can manage this course, its students and live classes." />
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
              <Avatar className="size-9">
                {r.avatar_url ? <AvatarImage src={r.avatar_url} alt="" /> : null}
                <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">{initials(r.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                {r.email ? <p className="truncate text-xs text-muted-foreground">{r.email}</p> : null}
              </div>
              <Select
                value={r.role}
                onValueChange={(v) => void update.run({ courseId, userId: r.user_id, role: v as "lead" | "assistant", canEdit: r.can_edit })}
                disabled={update.pending}
              >
                <SelectTrigger className="w-32" aria-label={`Role for ${r.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={r.can_edit}
                  disabled={update.pending}
                  onCheckedChange={(v) => void update.run({ courseId, userId: r.user_id, role: r.role, canEdit: v })}
                  aria-label={`${r.name} can edit content`}
                />
                Can edit
              </label>
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} className="text-muted-foreground hover:text-destructive">
                    <Trash2 />
                  </Button>
                }
                title={`Remove ${r.name} from this course?`}
                description="They lose access to the course content, its students and its messages."
                confirmLabel="Remove instructor"
                destructive
                requireReason
                action={({ reason }) => removeInstructor({ courseId, userId: r.user_id, reason })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
