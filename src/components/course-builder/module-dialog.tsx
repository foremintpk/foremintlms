"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { saveModule } from "@/lib/services/courses/actions/curriculum";
import type { BuilderModule } from "@/lib/services/courses/builder";
import { DateTimeField, FormRow, NumberField, SwitchRow, fieldError } from "./form-bits";

export function ModuleDialog({
  courseId,
  module,
  open,
  onOpenChange,
}: {
  courseId: string;
  module: BuilderModule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(module?.title ?? "");
  const [description, setDescription] = useState(module?.description ?? "");
  const [published, setPublished] = useState(module?.is_published ?? true);
  const [releaseAt, setReleaseAt] = useState<string | null>(module?.release_at ?? null);
  const [releaseDays, setReleaseDays] = useState<number | null>(module?.release_after_days ?? null);
  const action = useAction(saveModule, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run({
              courseId,
              moduleId: module?.id,
              title,
              description: description || null,
              is_published: published,
              release_at: releaseAt,
              release_after_days: releaseDays,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{module ? "Edit module" : "Add a module"}</DialogTitle>
            <DialogDescription>Modules group related lessons, like chapters in a book.</DialogDescription>
          </DialogHeader>
          <FormRow label="Module title" htmlFor="module-title" error={fieldError(action.fieldErrors, "title")}>
            <Input id="module-title" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <FormRow label="Description" htmlFor="module-description" optional>
            <Textarea id="module-description" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
          <SwitchRow
            label="Visible to students"
            description="Hidden modules and their lessons don't appear in the course."
            checked={published}
            onCheckedChange={setPublished}
          />
          <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Scheduled release (drip)</p>
            <FormRow label="Unlock on a date" optional hint="Shown in each student's local time.">
              <DateTimeField value={releaseAt} onChange={setReleaseAt} />
            </FormRow>
            <FormRow label="Or unlock after enrolling" optional error={fieldError(action.fieldErrors, "release_after_days")}>
              <div className="max-w-44">
                <NumberField value={releaseDays} onChange={setReleaseDays} min={0} max={3650} suffix="days" />
              </div>
            </FormRow>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending || !title.trim()}>
              {action.pending ? <Loader2 className="animate-spin" /> : null}
              {module ? "Save module" : "Add module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
