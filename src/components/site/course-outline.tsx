"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, FileText, ListChecks, PlayCircle, Radio, Layers, Eye } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { OutlineModule } from "@/lib/services/public/types";

const TYPE_ICON: Record<string, typeof PlayCircle> = {
  video: PlayCircle,
  article: FileText,
  quiz: ListChecks,
  assignment: ClipboardCheck,
  live: Radio,
  resource: FileText,
  mixed: Layers,
};

const TYPE_LABEL: Record<string, string> = {
  video: "Video",
  article: "Reading",
  quiz: "Quiz",
  assignment: "Assignment",
  live: "Live session",
  resource: "Resources",
  mixed: "Lesson",
};

function minutes(m: number | null) {
  if (!m) return null;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`;
}

export function CourseOutline({ modules, courseSlug }: { modules: OutlineModule[]; courseSlug: string }) {
  const [open, setOpen] = useState<string[]>(modules.slice(0, 1).map((m) => m.id));
  const allOpen = open.length === modules.length;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          onClick={() => setOpen(allOpen ? [] : modules.map((m) => m.id))}
        >
          {allOpen ? "Collapse all sections" : "Expand all sections"}
        </button>
      </div>
      <Accordion type="multiple" value={open} onValueChange={setOpen} className="overflow-hidden rounded-2xl border bg-card">
        {modules.map((m, mi) => {
          const total = m.lessons.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
          return (
            <AccordionItem key={m.id} value={m.id} className="border-b last:border-b-0">
              <AccordionTrigger className="px-5 py-4 text-left hover:no-underline">
                <span className="flex flex-1 flex-col gap-0.5 pr-3">
                  <span className="text-xs font-medium text-muted-foreground">Section {mi + 1}</span>
                  <span className="text-base font-semibold">{m.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
                    {total ? `, ${minutes(total)}` : ""}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                {m.description ? <p className="px-5 pb-3 text-sm text-muted-foreground">{m.description}</p> : null}
                <ul className="border-t">
                  {m.lessons.map((l) => {
                    const Icon = TYPE_ICON[l.lesson_type] ?? Layers;
                    return (
                      <li key={l.id} className="flex items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-label={TYPE_LABEL[l.lesson_type] ?? "Lesson"} />
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                        {l.is_preview ? (
                          <Link
                            href={`/learn/courses/${courseSlug}/lessons/${l.id}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                            prefetch={false}
                          >
                            <Eye className="size-3" aria-hidden />
                            Preview
                          </Link>
                        ) : null}
                        {l.duration_minutes ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{minutes(l.duration_minutes)}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
