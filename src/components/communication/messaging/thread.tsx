"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellOff, BellRing, ChevronLeft, Ellipsis, Flag, Paperclip, Pencil, RotateCcw, SendHorizontal, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload, type UploadedFile } from "@/components/common/file-upload";
import { LocalTime } from "@/components/common/local-time";
import { createClient } from "@/lib/supabase/browser";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonAvatar, RoleBadge, type PersonCard } from "../person";
import { PlainText } from "../plain-text";
import { ReportDialog } from "../report-dialog";
import { firstUnreadIndex } from "../lib/unread";
import {
  deleteMessageAction,
  editMessageAction,
  loadEarlierAction,
  loadMessageAction,
  markReadAction,
  removeMessageAction,
  reportMessageAction,
  sendMessageAction,
  setMutedAction,
} from "./actions";
import { channelState, ConnectionBanner, useIsClient, type ConnectionState } from "./realtime";

export interface ThreadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ThreadMessageData {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments: ThreadAttachment[];
}

interface PendingMessage {
  tempId: string;
  body: string;
  attachments: UploadedFile[];
  status: "sending" | "failed";
  error?: string;
}

interface MessageRowPayload {
  id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  conversation_id: string;
}

function dayKey(iso: string, local: boolean): string {
  const d = new Date(iso);
  return local ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : iso.slice(0, 10);
}

function dayLabel(iso: string, local: boolean): string {
  const d = new Date(iso);
  if (!local) return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: today.getFullYear() === d.getFullYear() ? undefined : "numeric" }).format(d);
}

function AttachmentChip({ file, mine }: { file: ThreadAttachment; mine: boolean }) {
  const isImage = file.mimeType.startsWith("image/");
  return (
    <a
      href={`/api/files/${file.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
        mine ? "border-white/25 bg-white/10 hover:bg-white/20" : "bg-background hover:bg-muted",
      )}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- authorised signed URL via redirect, not optimisable
        <img src={`/api/files/${file.id}`} alt="" loading="lazy" className="size-10 rounded object-cover" />
      ) : (
        <Paperclip className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 truncate font-medium">{file.fileName}</span>
      <span className={cn("shrink-0", mine ? "text-white/70" : "text-muted-foreground")}>{formatBytes(file.size)}</span>
    </a>
  );
}

export function MessageThread({
  conversationId,
  meId,
  participants,
  initialMessages,
  initialHasMore,
  lastReadAt,
  isParticipant,
  isMuted,
  canModerate,
  backHref,
  title,
  courseTitle,
}: {
  conversationId: string;
  meId: string;
  participants: PersonCard[];
  initialMessages: ThreadMessageData[];
  initialHasMore: boolean;
  lastReadAt: string | null;
  isParticipant: boolean;
  isMuted: boolean;
  canModerate: boolean;
  backHref: string;
  title: string;
  courseTitle: string | null;
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const [messages, setMessages] = useState<ThreadMessageData[]>(initialMessages);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempSeq = useRef(0);
  // The "New" divider marks where unread messages began when the thread opened.
  const [firstUnreadId] = useState<string | null>(() => {
    const idx = firstUnreadIndex(
      initialMessages.map((m) => ({ created_at: m.createdAt, sender_id: m.senderId, deleted_at: m.deletedAt })),
      lastReadAt,
      meId,
    );
    return idx > 0 ? initialMessages[idx].id : null;
  });

  const people = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const others = participants.filter((p) => p.id !== meId);
  const group = participants.length > 2;

  const markRead = useCallback(() => {
    if (!isParticipant) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await markReadAction({ conversationId });
      if (res.ok) router.refresh();
    }, 900);
  }, [conversationId, isParticipant, router]);

  // Mark read on open and whenever the tab becomes visible again.
  useEffect(() => {
    markRead();
    const onVisible = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [markRead]);

  // Realtime: new and edited messages in this conversation (RLS-filtered).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRowPayload;
          // Attachments are linked right after the insert; fetch the full message shortly after.
          setTimeout(async () => {
            const res = await loadMessageAction({ messageId: row.id });
            const full = res.ok && res.data ? res.data : null;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              const next: ThreadMessageData = full ?? {
                id: row.id,
                conversationId: row.conversation_id,
                senderId: row.sender_id,
                body: row.deleted_at ? "" : row.body,
                createdAt: row.created_at,
                editedAt: row.edited_at,
                deletedAt: row.deleted_at,
                attachments: [],
              };
              return [...prev, next].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            });
            if (row.sender_id !== meId) markRead();
          }, row.sender_id === meId ? 0 : 600);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRowPayload;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? { ...m, body: row.deleted_at ? "" : row.body, editedAt: row.edited_at, deletedAt: row.deleted_at, attachments: row.deleted_at ? [] : m.attachments }
                : m,
            ),
          );
        },
      )
      .subscribe((status) => setConn(channelState(status)));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, meId, markRead]);

  // Keep the newest message in view unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingEarlier(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await loadEarlierAction({ conversationId, before: oldest.createdAt });
    setLoadingEarlier(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    stickToBottom.current = false;
    setMessages((prev) => [...res.data.messages.filter((m) => !prev.some((p) => p.id === m.id)), ...prev]);
    setHasMore(res.data.hasMore);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  };

  const deliver = async (item: PendingMessage) => {
    setPending((prev) => prev.map((p) => (p.tempId === item.tempId ? { ...p, status: "sending", error: undefined } : p)));
    const res = await sendMessageAction({ conversationId, body: item.body, attachmentIds: item.attachments.map((a) => a.id) });
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.tempId !== item.tempId));
      setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
      router.refresh();
    } else {
      setPending((prev) => prev.map((p) => (p.tempId === item.tempId ? { ...p, status: "failed", error: res.error } : p)));
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body && files.length === 0) return;
    tempSeq.current += 1;
    const item: PendingMessage = { tempId: `tmp-${tempSeq.current}`, body, attachments: files, status: "sending" };
    stickToBottom.current = true;
    setPending((prev) => [...prev, item]);
    setDraft("");
    setFiles([]);
    setShowUpload(false);
    void deliver(item);
  };

  const saveEdit = () =>
    startTransition(async () => {
      if (!editing) return;
      const res = await editMessageAction({ messageId: editing.id, body: editing.body });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === editing.id ? { ...m, body: editing.body.trim(), editedAt: new Date().toISOString() } : m)));
        setEditing(null);
      } else toast.error(res.error);
    });

  const remove = (id: string, moderator: boolean) =>
    startTransition(async () => {
      const res = moderator ? await removeMessageAction({ messageId: id, reason: "Removed by a moderator from the conversation view" }) : await deleteMessageAction({ messageId: id });
      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: "", deletedAt: new Date().toISOString(), attachments: [] } : m)));
        toast.success(moderator ? "Message removed" : "Message deleted");
      } else toast.error(res.error);
    });

  const toggleMute = () =>
    startTransition(async () => {
      const res = await setMutedAction({ conversationId, muted: !muted });
      if (res.ok) {
        setMuted(!muted);
        toast.success(res.message ?? "Saved");
      } else toast.error(res.error);
    });

  const rows = messages.map((m, i) => {
    const prev = messages[i - 1];
    const day = dayKey(m.createdAt, isClient);
    const showDay = !prev || dayKey(prev.createdAt, isClient) !== day;
    const continued = Boolean(prev && prev.senderId === m.senderId && !showDay && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000);
    return { m, showDay, continued };
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2.5 sm:px-4">
        <Link href={backHref} className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label="Back to conversations">
          <ChevronLeft className="size-5" />
        </Link>
        {others[0] ? <PersonAvatar person={others[0]} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {others.length === 1 ? <RoleBadge role={others[0].role} /> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {courseTitle ? courseTitle : group ? `${participants.length} people` : "Private conversation"}
          </p>
        </div>
        {isParticipant ? (
          <Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? "Turn email alerts on" : "Mute email alerts"} title={muted ? "Turn email alerts on" : "Mute email alerts"}>
            {muted ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
          </Button>
        ) : null}
      </header>

      <ConnectionBanner state={conn} />
      {!isParticipant ? (
        <div className="flex items-center gap-2 border-b bg-info-soft px-4 py-2 text-xs font-medium text-info">
          <ShieldAlert className="size-3.5" />
          You’re viewing this conversation as a moderator. Participants aren’t notified.
        </div>
      ) : null}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-label="Messages">
        {hasMore ? (
          <div className="mb-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={loadEarlier} disabled={loadingEarlier}>
              {loadingEarlier ? "Loading…" : "Load earlier messages"}
            </Button>
          </div>
        ) : messages.length > 0 ? (
          <p className="mb-4 text-center text-xs text-muted-foreground">This is the start of your conversation.</p>
        ) : null}

        {messages.length === 0 && pending.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-xs space-y-1">
              <p className="text-sm font-medium">Say hello</p>
              <p className="text-xs text-muted-foreground">Messages are private between you and {others[0]?.name ?? "the other person"}.</p>
            </div>
          </div>
        ) : null}

        <ol className="space-y-1.5">
          {rows.map(({ m, showDay, continued }) => {
            const mine = m.senderId === meId;
            const sender = m.senderId ? people.get(m.senderId) : null;
            const isEditing = editing?.id === m.id;
            return (
              <li key={m.id} id={`message-${m.id}`}>
                {showDay ? (
                  <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {dayLabel(m.createdAt, isClient)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                ) : null}
                {m.id === firstUnreadId ? (
                  <div className="my-3 flex items-center gap-3 text-[11px] font-semibold text-primary">
                    <span className="h-px flex-1 bg-primary/40" />
                    New
                    <span className="h-px flex-1 bg-primary/40" />
                  </div>
                ) : null}
                <div className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start", !continued && "mt-3")}>
                  {!mine ? (
                    <div className="w-8 shrink-0">{!continued && sender ? <PersonAvatar person={sender} className="size-8" /> : null}</div>
                  ) : null}
                  <div className={cn("flex max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                    {!mine && !continued && group && sender ? <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">{sender.name}</span> : null}
                    <div className="flex items-center gap-1">
                      {mine && !m.deletedAt && isParticipant ? (
                        <MessageMenu onEdit={() => setEditing({ id: m.id, body: m.body })} onDelete={() => remove(m.id, false)} own />
                      ) : null}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2",
                          m.deletedAt
                            ? "border border-dashed bg-transparent text-muted-foreground italic"
                            : mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-muted text-foreground",
                        )}
                      >
                        {m.deletedAt ? (
                          <p className="text-sm">Message deleted</p>
                        ) : isEditing ? (
                          <div className="w-64 max-w-full space-y-2 sm:w-80">
                            <Textarea
                              value={editing.body}
                              onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                              rows={3}
                              className="bg-background text-foreground"
                              aria-label="Edit message"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={saveEdit} disabled={!editing.body.trim()}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <PlainText text={m.body} className={cn("text-sm", mine && "[&_a]:text-primary-foreground [&_a]:decoration-white/60")} />
                            {m.attachments.length ? (
                              <div className="mt-2 flex flex-col gap-1.5">
                                {m.attachments.map((a) => (
                                  <AttachmentChip key={a.id} file={a} mine={mine} />
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                      {!mine && !m.deletedAt ? (
                        <MessageMenu
                          onReport={isParticipant ? () => setReporting(m.id) : undefined}
                          onRemove={canModerate ? () => remove(m.id, true) : undefined}
                        />
                      ) : null}
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                      <LocalTime value={m.createdAt} format="time" />
                      {m.editedAt && !m.deletedAt ? " · edited" : ""}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {pending.map((p) => (
            <li key={p.tempId} className="mt-3 flex justify-end">
              <div className="flex max-w-[85%] flex-col items-end sm:max-w-[70%]">
                <div className={cn("rounded-2xl rounded-br-md px-3.5 py-2", p.status === "failed" ? "border border-destructive/40 bg-destructive/10" : "bg-primary/70 text-primary-foreground")}>
                  {p.body ? <PlainText text={p.body} className="text-sm" /> : null}
                  {p.attachments.map((a) => (
                    <p key={a.id} className="mt-1 flex items-center gap-1 text-xs">
                      <Paperclip className="size-3" /> {a.fileName}
                    </p>
                  ))}
                </div>
                {p.status === "sending" ? (
                  <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">Sending…</span>
                ) : (
                  <span className="mt-1 flex items-center gap-2 px-1 text-[11px] text-destructive">
                    {p.error ?? "Not sent"}
                    <button type="button" className="inline-flex items-center gap-1 font-medium underline" onClick={() => void deliver(p)}>
                      <RotateCcw className="size-3" /> Retry
                    </button>
                    <button type="button" className="font-medium underline" onClick={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}>
                      Discard
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {isParticipant ? (
        <div className="border-t bg-background p-3">
          {showUpload ? (
            <div className="mb-3 rounded-xl border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium">Attach files</p>
                <button type="button" onClick={() => setShowUpload(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Close attachments">
                  <X className="size-4" />
                </button>
              </div>
              <FileUpload
                purpose="message_attachment"
                context={{ conversationId }}
                multiple
                maxFiles={5}
                label="Choose files"
                hint="PDF, Word, images or text, up to the size limit set by your academy."
                onUploaded={(f) => setFiles((prev) => (prev.length >= 5 ? prev : [...prev, f]))}
              />
            </div>
          ) : null}
          {files.length ? (
            <ul className="mb-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-40 truncate">{f.fileName}</span>
                  <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-foreground">
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowUpload((v) => !v)} aria-label="Attach files" aria-pressed={showUpload}>
              <Paperclip className="size-4" />
            </Button>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={10_000}
              placeholder="Write a message"
              aria-label="Message"
              className="max-h-40 min-h-10 flex-1 resize-none field-sizing-content"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() && files.length === 0} aria-label="Send message">
              <SendHorizontal className="size-4" />
            </Button>
          </form>
          <p className="mt-1.5 text-[11px] text-muted-foreground max-sm:hidden">Enter to send · Shift + Enter for a new line</p>
        </div>
      ) : null}

      <ReportDialog
        open={Boolean(reporting)}
        onOpenChange={(o) => !o && setReporting(null)}
        what="message"
        onSubmit={async (input) => {
          if (!reporting) return { ok: false, error: "Nothing to report." };
          const res = await reportMessageAction({ messageId: reporting, ...input });
          return res.ok ? { ok: true, message: res.message } : { ok: false, error: res.error };
        }}
      />
    </div>
  );
}

function MessageMenu({
  own,
  onEdit,
  onDelete,
  onReport,
  onRemove,
}: {
  own?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onRemove?: () => void;
}) {
  if (!onEdit && !onDelete && !onReport && !onRemove) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-md p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
        aria-label="Message options"
      >
        <Ellipsis className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={own ? "end" : "start"}>
        {onEdit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 /> Delete
          </DropdownMenuItem>
        ) : null}
        {onReport ? (
          <DropdownMenuItem onSelect={onReport}>
            <Flag /> Report
          </DropdownMenuItem>
        ) : null}
        {onReport && onRemove ? <DropdownMenuSeparator /> : null}
        {onRemove ? (
          <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
            <ShieldAlert /> Remove as moderator
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
