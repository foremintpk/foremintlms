"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { createCourse } from "@/lib/services/courses/actions/course";
import type { CategoryOption } from "@/lib/services/courses/builder";
import { FormRow, fieldError } from "./form-bits";

export function NewCourseForm({ area, categories }: { area: "teach" | "admin"; categories: CategoryOption[] }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const create = useAction(createCourse);
  return (
    <form
      className="grid max-w-xl gap-5 rounded-2xl border bg-card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void create.run({ title, categoryId, area });
      }}
    >
      <FormRow label="Course title" htmlFor="new-title" error={fieldError(create.fieldErrors, "title")} hint="You can change it later.">
        <Input id="new-title" value={title} maxLength={200} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Shopify Store Launch" />
      </FormRow>
      <FormRow label="Category" optional>
        <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
          <SelectTrigger className="w-full" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Choose later</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormRow>
      {create.error && !Object.keys(create.fieldErrors).length ? <p className="text-sm text-destructive">{create.error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!title.trim() || create.pending}>
          {create.pending ? <Loader2 className="animate-spin" /> : null}
          Create draft course
        </Button>
      </div>
    </form>
  );
}
