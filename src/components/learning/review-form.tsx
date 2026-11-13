"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { saveReviewAction } from "@/app/learn/courses/actions";
import { cn } from "@/lib/utils";

export function ReviewForm({
  courseId,
  existing,
}: {
  courseId: string;
  existing: { rating: number; title: string | null; body: string | null; status: string } | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const { run, pending, fieldErrors } = useAction(saveReviewAction);
  const shown = hover || rating;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ courseId, rating, title: title.trim() || undefined, body: body.trim() || undefined });
      }}
    >
      {existing ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {existing.status === "published"
            ? "Your review is published. Editing it sends it back for moderation."
            : existing.status === "rejected"
              ? "Your review wasn't approved. You can edit and resubmit it."
              : "Your review is waiting for moderation."}
        </p>
      ) : null}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="rounded p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Star className={cn("size-7 transition-colors", n <= shown ? "fill-[#F5A524] text-[#F5A524]" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
        {fieldErrors.rating ? <p className="mt-1 text-sm text-destructive">{fieldErrors.rating[0]}</p> : null}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="review-title">Headline (optional)</Label>
        <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="review-body">What did you think? (optional)</Label>
        <Textarea id="review-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} />
      </div>
      <Button type="submit" disabled={pending || rating === 0}>
        {pending ? "Submitting…" : existing ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
