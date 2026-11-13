"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BellOff, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/common/local-time";
import { cn } from "@/lib/utils";
import { PersonAvatar, RoleBadge, type PersonCard } from "../person";
import { previewText } from "../lib/text";
import { ConversationListRefresher } from "./realtime";
import { NewMessageDialog } from "./new-message-dialog";

export interface ConversationListItem {
  id: string;
  subject: string | null;
  courseTitle: string | null;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageSenderId: string | null;
  createdAt: string;
  unreadCount: number;
  isMuted: boolean;
  other: PersonCard | null;
}

export function ConversationList({
  area,
  basePath,
  conversations,
  activeId,
  meId,
  canStartNew = true,
}: {
  area: "learn" | "teach" | "admin";
  basePath: string;
  conversations: ConversationListItem[];
  activeId?: string | null;
  meId: string;
  canStartNew?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return conversations;
    return conversations.filter(
      (c) =>
        c.other?.name.toLowerCase().includes(f) ||
        c.subject?.toLowerCase().includes(f) ||
        c.courseTitle?.toLowerCase().includes(f) ||
        c.lastMessageBody?.toLowerCase().includes(f),
    );
  }, [conversations, filter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConversationListRefresher channelKey={meId} />
      <div className="flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter conversations"
            aria-label="Filter conversations"
            className="h-9 pl-8"
          />
        </div>
        {canStartNew ? <NewMessageDialog area={area} /> : null}
      </div>
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
        <span>
          {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
        </span>
        <Link href={`${basePath}?search=1`} className="font-medium text-primary hover:underline">
          Search messages
        </Link>
      </div>
      {visible.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {conversations.length === 0 ? "No conversations yet." : "No conversations match that filter."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversations">
          {visible.map((c) => {
            const active = c.id === activeId;
            const unread = c.unreadCount > 0;
            const fromMe = c.lastMessageSenderId === meId;
            const name = c.other?.name ?? c.subject ?? "Conversation";
            return (
              <li key={c.id}>
                <Link
                  href={`${basePath}/${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex gap-3 border-b px-3 py-3 transition-colors hover:bg-muted/60",
                    active && "bg-brand-soft/70 hover:bg-brand-soft",
                  )}
                >
                  <PersonAvatar person={{ name, avatarUrl: c.other?.avatarUrl ?? null }} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className={cn("min-w-0 truncate text-sm", unread ? "font-semibold text-foreground" : "font-medium")}>{name}</p>
                      {c.isMuted ? <BellOff className="size-3 shrink-0 text-muted-foreground" aria-label="Email alerts muted" /> : null}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        <LocalTime value={c.lastMessageAt ?? c.createdAt} format="relative" />
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {c.other ? <RoleBadge role={c.other.role} className="h-4 px-1.5 text-[10px]" /> : null}
                      {c.courseTitle ? <span className="truncate text-[11px] text-muted-foreground">{c.courseTitle}</span> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className={cn("min-w-0 flex-1 truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                        {c.lastMessageBody ? `${fromMe ? "You: " : ""}${previewText(c.lastMessageBody, 90)}` : "No messages yet"}
                      </p>
                      {unread ? (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          <span className="sr-only"> unread</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
