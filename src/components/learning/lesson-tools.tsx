"use client";

import { useState, useSyncExternalStore } from "react";
import { Bookmark, BookmarkPlus, Pencil, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { formatTimestamp } from "@/lib/format";
import {
  addBookmarkAction,
  addNoteAction,
  deleteBookmarkAction,
  deleteNoteAction,
  updateNoteAction,
} from "@/app/learn/courses/actions";
import { playbackStore } from "./playback-store";

interface Note {
  id: string;
  body: string;
  position_seconds: number | null;
  created_at: string;
}
interface BookmarkItem {
  id: string;
  label: string | null;
  position_seconds: number | null;
}

function useCurrentTime(lessonId: string) {
  return useSyncExternalStore(
    playbackStore.subscribe,
    () => playbackStore.getTime(lessonId),
    () => 0,
  );
}

function SeekButton({ seconds }: { seconds: number }) {
  return (
    <button
      type="button"
      onClick={() => playbackStore.seek(seconds)}
      className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/15"
      aria-label={`Jump to ${formatTimestamp(seconds)}`}
    >
      <Play className="size-3" aria-hidden /> {formatTimestamp(seconds)}
    </button>
  );
}

function NotesPanel({ lessonId, notes, hasVideo }: { lessonId: string; notes: Note[]; hasVideo: boolean }) {
  const [body, setBody] = useState("");
  const [stamp, setStamp] = useState(hasVideo);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const time = useCurrentTime(lessonId);
  const add = useAction(addNoteAction, { onSuccess: () => setBody("") });
  const update = useAction(updateNoteAction, { onSuccess: () => setEditing(null) });
  const remove = useAction(deleteNoteAction);

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add.run({ lessonId, body, positionSeconds: stamp && hasVideo ? time : null });
        }}
      >
        <label htmlFor="new-note" className="sr-only">
          New note
        </label>
        <Textarea
          id="new-note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a private note…"
          rows={3}
          maxLength={20000}
        />
        <div className="flex items-center justify-between gap-2">
          {hasVideo ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} className="accent-[var(--primary)]" />
              Attach video time ({formatTimestamp(time)})
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={add.pending || body.trim().length === 0}>
            {add.pending ? "Saving…" : "Save note"}
          </Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Notes are private to you and saved with this lesson.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border bg-card p-3 text-sm">
              {editing === n.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void update.run({ id: n.id, body: draft });
                  }}
                >
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Edit note" />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={update.pending || !draft.trim()}>
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    {n.position_seconds != null ? <SeekButton seconds={Number(n.position_seconds)} /> : <span />}
                    <span className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Edit note"
                        onClick={() => {
                          setEditing(n.id);
                          setDraft(n.body);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-xs" aria-label="Delete note" disabled={remove.pending} onClick={() => remove.run({ id: n.id })}>
                        <Trash2 />
                      </Button>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{n.body}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookmarksPanel({ lessonId, bookmarks, hasVideo }: { lessonId: string; bookmarks: BookmarkItem[]; hasVideo: boolean }) {
  const [label, setLabel] = useState("");
  const time = useCurrentTime(lessonId);
  const add = useAction(addBookmarkAction, { onSuccess: () => setLabel("") });
  const remove = useAction(deleteBookmarkAction);
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add.run({ lessonId, positionSeconds: hasVideo ? time : null, label: label.trim() || undefined });
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={hasVideo ? `Label for ${formatTimestamp(time)}` : "Label (optional)"} maxLength={200} aria-label="Bookmark label" />
        <Button type="submit" size="sm" variant="outline" disabled={add.pending} className="h-9 shrink-0">
          <BookmarkPlus /> Add
        </Button>
      </form>
      {bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasVideo ? "Bookmark moments in the video to jump back to them later." : "Bookmark this lesson to find it again quickly."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {bookmarks.map((b) => (
            <li key={b.id} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-sm">
              <Bookmark className="size-3.5 shrink-0 text-primary" aria-hidden />
              {b.position_seconds != null ? <SeekButton seconds={Number(b.position_seconds)} /> : null}
              <span className="min-w-0 flex-1 truncate">{b.label || (b.position_seconds != null ? "Bookmark" : "This lesson")}</span>
              <Button variant="ghost" size="icon-xs" aria-label="Remove bookmark" disabled={remove.pending} onClick={() => remove.run({ id: b.id })}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Notes and bookmarks for the current lesson (private to the learner). */
export function LessonTools({
  lessonId,
  notes,
  bookmarks,
  hasVideo,
  resources,
}: {
  lessonId: string;
  notes: Note[];
  bookmarks: BookmarkItem[];
  hasVideo: boolean;
  resources: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="resources" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="resources" className="flex-1">
          Resources
        </TabsTrigger>
        <TabsTrigger value="notes" className="flex-1">
          Notes{notes.length ? ` (${notes.length})` : ""}
        </TabsTrigger>
        <TabsTrigger value="bookmarks" className="flex-1">
          Bookmarks
        </TabsTrigger>
      </TabsList>
      <TabsContent value="resources" className="pt-3">
        {resources}
      </TabsContent>
      <TabsContent value="notes" className="pt-3">
        <NotesPanel lessonId={lessonId} notes={notes} hasVideo={hasVideo} />
      </TabsContent>
      <TabsContent value="bookmarks" className="pt-3">
        <BookmarksPanel lessonId={lessonId} bookmarks={bookmarks} hasVideo={hasVideo} />
      </TabsContent>
    </Tabs>
  );
}
