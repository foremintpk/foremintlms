import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, MessageSquare, Search, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/common/local-time";
import { requireUser } from "@/lib/auth/guards";
import { UserFacingError } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  listConversations,
  loadConversation,
  MESSAGES_BASE,
  searchMessages,
  startConversation,
  type CommsArea,
  type ConversationSummary,
} from "@/lib/services/messaging";
import { previewText } from "../lib/text";
import { ConversationList, type ConversationListItem } from "./conversation-list";
import { MessageThread } from "./thread";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function toListItems(conversations: ConversationSummary[]): ConversationListItem[] {
  return conversations.map((c) => ({
    id: c.id,
    subject: c.subject,
    courseTitle: c.courseTitle,
    lastMessageAt: c.lastMessageAt,
    lastMessageBody: c.lastMessageBody,
    lastMessageSenderId: c.lastMessageSenderId,
    createdAt: c.createdAt,
    unreadCount: c.unreadCount,
    isMuted: c.isMuted,
    other: c.other,
  }));
}

const INTRO: Record<CommsArea, string> = {
  learn: "Private conversations with your instructors.",
  teach: "Private conversations with students in your courses.",
  admin: "Your conversations, plus moderation of reported messages.",
};

function Frame({
  area,
  list,
  pane,
  showPaneOnMobile,
}: {
  area: CommsArea;
  list: React.ReactNode;
  pane: React.ReactNode;
  showPaneOnMobile: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", showPaneOnMobile && "max-md:hidden")}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Messages</h1>
          <p className="text-sm text-muted-foreground">{INTRO[area]}</p>
        </div>
        {area === "admin" ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/messages/reported">
              <ShieldAlert className="size-4" /> Reported conversations
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid h-[calc(100svh-12.5rem)] min-h-[26rem] overflow-hidden rounded-2xl border bg-card shadow-card md:h-[calc(100svh-11rem)] md:grid-cols-[minmax(17rem,22rem)_1fr]">
        <aside className={cn("min-h-0 border-r", showPaneOnMobile ? "max-md:hidden" : "")}>{list}</aside>
        <section className={cn("min-h-0", showPaneOnMobile ? "" : "max-md:hidden")}>{pane}</section>
      </div>
    </div>
  );
}

function EmptyPane({ hasConversations }: { hasConversations: boolean }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="max-w-xs space-y-2">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-soft text-primary">
          <MessageSquare className="size-5" />
        </span>
        <p className="text-sm font-semibold">{hasConversations ? "Choose a conversation" : "No messages yet"}</p>
        <p className="text-sm text-muted-foreground">
          {hasConversations ? "Pick a conversation on the left to read and reply." : "Start a conversation with “New message”."}
        </p>
      </div>
    </div>
  );
}

async function SearchPane({ area, q }: { area: CommsArea; q: string }) {
  const base = MESSAGES_BASE[area];
  const hits = q.trim().length >= 2 ? await searchMessages(q) : [];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <form action={base} className="flex items-center gap-2 border-b p-3">
        <input type="hidden" name="search" value="1" />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={q} placeholder="Search your messages" aria-label="Search your messages" className="h-9 pl-8" autoFocus />
        </div>
        <Button type="submit" size="sm" className="h-9">
          Search
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9">
          <Link href={base}>Close</Link>
        </Button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {q.trim().length < 2 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Search for words in any of your conversations.</p>
        ) : hits.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No messages match “{q}”.</p>
        ) : (
          <ul>
            {hits.map((h) => (
              <li key={h.messageId}>
                <Link href={`${base}/${h.conversationId}#message-${h.messageId}`} className="block border-b px-4 py-3 hover:bg-muted/60">
                  <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{h.senderName}</span>
                    {h.otherName ? <span>in conversation with {h.otherName}</span> : null}
                    <span className="ml-auto">
                      <LocalTime value={h.createdAt} format="date" />
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{previewText(h.body, 220)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** /{area}/messages — inbox, `?to=<userId>` deep link and `?search=1&q=` search. */
export async function MessagesIndexScreen({ area, searchParams }: { area: CommsArea; searchParams: SearchParams }) {
  const base = MESSAGES_BASE[area];
  const user = await requireUser(base);

  const to = first(searchParams.to);
  let startError: string | null = null;
  if (to) {
    const parsed = z.uuid().safeParse(to);
    if (!parsed.success || parsed.data === user.id) {
      startError = "That conversation link isn't valid.";
    } else {
      let conversationId: string | null = null;
      try {
        conversationId = await startConversation(parsed.data);
      } catch (err) {
        if (err instanceof UserFacingError) startError = err.message;
        else throw err;
      }
      if (conversationId) redirect(`${base}/${conversationId}`);
    }
  }

  const conversations = await listConversations();
  const searching = first(searchParams.search) === "1";
  const q = first(searchParams.q) ?? "";

  return (
    <>
      {startError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle />
          <AlertTitle>We couldn’t open that conversation</AlertTitle>
          <AlertDescription>{startError}</AlertDescription>
        </Alert>
      ) : null}
      <Frame
        area={area}
        showPaneOnMobile={searching}
        list={<ConversationList area={area} basePath={base} conversations={toListItems(conversations)} meId={user.id} />}
        pane={searching ? <SearchPane area={area} q={q} /> : <EmptyPane hasConversations={conversations.length > 0} />}
      />
    </>
  );
}

/** /{area}/messages/[id] — a single conversation with the list beside it on desktop. */
export async function ConversationScreen({ area, id }: { area: CommsArea; id: string }) {
  const base = MESSAGES_BASE[area];
  const user = await requireUser(`${base}/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [detail, conversations] = await Promise.all([loadConversation(user, id), listConversations()]);
  if (!detail) notFound();

  const others = detail.participants.filter((p) => p.id !== user.id);
  const title = detail.isParticipant
    ? others.map((p) => p.name).join(", ") || detail.subject || "Conversation"
    : detail.participants.map((p) => p.name).join(" and ") || "Conversation";

  return (
    <Frame
      area={area}
      showPaneOnMobile
      list={<ConversationList area={area} basePath={base} conversations={toListItems(conversations)} activeId={id} meId={user.id} />}
      pane={
        <MessageThread
          key={id}
          conversationId={id}
          meId={user.id}
          participants={detail.participants}
          initialMessages={detail.messages}
          initialHasMore={detail.hasMore}
          lastReadAt={detail.lastReadAt}
          isParticipant={detail.isParticipant}
          isMuted={detail.isMuted}
          canModerate={area === "admin" && user.roles.includes("admin")}
          backHref={base}
          title={title}
          courseTitle={detail.courseTitle}
        />
      }
    />
  );
}
