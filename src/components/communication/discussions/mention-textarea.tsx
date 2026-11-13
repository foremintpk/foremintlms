"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "../person";
import { activeMentionQuery } from "../lib/text";
import { searchMembersAction } from "./actions";

export interface Mention {
  id: string;
  name: string;
}

interface Suggestion {
  id: string;
  name: string;
  avatarUrl: string | null;
  isInstructor: boolean;
}

/** Mentions still present in the text ("@Name") — the rest were deleted by the writer. */
export function liveMentionIds(text: string, mentions: Mention[]): string[] {
  return [...new Set(mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id))];
}

/**
 * Textarea with @mention suggestions for members of the course. Typing "@"
 * followed by a name shows matching classmates and instructors.
 */
export function MentionTextarea({
  courseId,
  value,
  onChange,
  mentions,
  onMentionsChange,
  placeholder,
  rows = 4,
  id,
  ariaLabel,
  autoFocus,
  maxLength = 20_000,
}: {
  courseId: string;
  value: string;
  onChange: (value: string) => void;
  mentions: Mention[];
  onMentionsChange: (mentions: Mention[]) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query) return;
    const id = ++reqId.current;
    timer.current = setTimeout(async () => {
      const res = await searchMembersAction({ courseId, q: query.query });
      if (id !== reqId.current) return;
      setSuggestions(res.ok ? res.data : []);
      setActive(0);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, courseId]);

  const updateQuery = (text: string, caret: number) => {
    const q = activeMentionQuery(text, caret);
    setQuery(q);
    if (!q) setSuggestions([]);
  };

  const choose = (s: Suggestion) => {
    if (!query) return;
    const before = value.slice(0, query.start);
    const after = value.slice(query.start + 1 + query.query.length);
    const insert = `@${s.name} `;
    const next = `${before}${insert}${after}`;
    onChange(next);
    if (!mentions.some((m) => m.id === s.id)) onMentionsChange([...mentions, { id: s.id, name: s.name }]);
    setQuery(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const pos = before.length + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const open = Boolean(query) && suggestions.length > 0;

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          updateQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={(e) => updateQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setQuery(null);
            setSuggestions([]);
          }
        }}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        className="resize-y"
      />
      {open ? (
        <ul role="listbox" aria-label="Mention someone" className="absolute z-20 mt-1 max-h-56 w-full max-w-sm overflow-y-auto rounded-xl border bg-popover p-1 shadow-raised">
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === active ? "bg-muted" : "hover:bg-muted/60")}
              >
                <PersonAvatar person={s} className="size-6" />
                <span className="truncate">{s.name}</span>
                {s.isInstructor ? <span className="ml-auto text-[11px] font-medium text-primary">Instructor</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[11px] text-muted-foreground">Type @ to mention someone in this course.</p>
    </div>
  );
}
