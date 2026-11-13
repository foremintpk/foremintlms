import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { linkify } from "./lib/text";

/**
 * Renders user-written plain text: preserves line breaks and turns http(s)
 * URLs into safe external links. Never interprets HTML.
 */
export function PlainText({ text, className }: { text: string; className?: string }) {
  const segments = linkify(text);
  return (
    <div className={cn("text-[0.95rem] leading-relaxed break-words whitespace-normal", className)}>
      {segments.map((s, i) =>
        s.type === "break" ? (
          <br key={i} />
        ) : s.type === "link" ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {s.value}
          </a>
        ) : (
          <Fragment key={i}>{s.value}</Fragment>
        ),
      )}
    </div>
  );
}
