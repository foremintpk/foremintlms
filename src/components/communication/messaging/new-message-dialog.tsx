"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTrackedTransition } from "@/hooks/use-tracked-transition";
import { PenSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PersonAvatar, RoleBadge, type PersonRole } from "../person";
import { searchContactsAction, startConversationAction } from "./actions";

interface ContactItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: PersonRole;
  context: string | null;
}

const HINT: Record<"learn" | "teach" | "admin", string> = {
  learn: "You can message the instructors of courses you're enrolled in.",
  teach: "You can message students enrolled in your courses.",
  admin: "Search for anyone on the platform by name or email.",
};

export function NewMessageDialog({ area }: { area: "learn" | "teach" | "admin" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTrackedTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    const id = ++requestId.current;
    timer.current = setTimeout(
      async () => {
        if (area === "admin" && q.trim().length < 2) {
          setResults([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        const res = await searchContactsAction({ q });
        if (id !== requestId.current) return;
        setLoading(false);
        if (res.ok) {
          setResults(res.data);
          setError(null);
        } else setError(res.error);
      },
      q ? 300 : 0,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open, area]);

  const start = (contact: ContactItem) =>
    startTransition(async () => {
      const res = await startConversationAction({ otherUserId: contact.id, area });
      if (res.ok) {
        setOpen(false);
        router.push(res.data.href);
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5">
          <PenSquare className="size-4" />
          <span className="max-sm:sr-only">New message</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>{HINT[area]}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={area === "admin" ? "Name or email" : "Search by name"}
            aria-label="Search people"
            className="pl-8"
          />
        </div>
        <div className="max-h-80 min-h-32 overflow-y-auto" aria-live="polite">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {area === "admin" && q.trim().length < 2
                ? "Type at least two characters to search."
                : q
                  ? "Nobody you can message matches that name."
                  : area === "learn"
                    ? "No instructors yet. Enroll in a course to message its instructors."
                    : "No students yet."}
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => start(c)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <PersonAvatar person={c} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <RoleBadge role={c.role} />
                      </span>
                      {c.context ? <span className="block truncate text-xs text-muted-foreground">{c.context}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
