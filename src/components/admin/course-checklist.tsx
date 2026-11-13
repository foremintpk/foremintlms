"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/status-badge";

export interface ChecklistCourse {
  id: string;
  title: string;
  status: string;
  hint?: string;
}

/** Searchable checkbox list of courses. */
export function CourseChecklist({
  courses,
  value,
  onChange,
  maxHeight = 320,
}: {
  courses: ChecklistCourse[];
  value: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: number;
}) {
  const [q, setQ] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? courses.filter((c) => c.title.toLowerCase().includes(needle)) : courses;
  }, [courses, q]);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" className="pl-8" aria-label="Search courses" />
      </div>
      <p className="text-xs text-muted-foreground">{selected.size} selected</p>
      <ul className="overflow-y-auto rounded-xl border" style={{ maxHeight }}>
        {filtered.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No courses match.</li> : null}
        {filtered.map((c) => {
          const id = `course-check-${c.id}`;
          return (
            <li key={c.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
              <Checkbox
                id={id}
                checked={selected.has(c.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) next.add(c.id);
                  else next.delete(c.id);
                  onChange([...next]);
                }}
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
                {c.title}
                {c.hint ? <span className="ml-2 text-xs text-muted-foreground">{c.hint}</span> : null}
              </label>
              <StatusBadge status={c.status} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
