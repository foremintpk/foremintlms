"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** True only after hydration — lets client-only formatting avoid mismatches. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Map Supabase channel status callbacks to a user-facing connection state. */
export function channelState(status: string): ConnectionState {
  if (status === "SUBSCRIBED") return "live";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") return "reconnecting";
  return "connecting";
}

export function ConnectionBanner({ state, className }: { state: ConnectionState; className?: string }) {
  const online = useOnline();
  const effective: ConnectionState = online ? state : "offline";
  if (effective === "live" || effective === "connecting") return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 border-b bg-warning-soft px-4 py-2 text-xs font-medium text-warning",
        className,
      )}
    >
      <WifiOff className="size-3.5" />
      {effective === "offline"
        ? "You're offline. Messages will send when you reconnect."
        : "Reconnecting… new messages will appear once the connection is back."}
    </div>
  );
}

/**
 * Re-renders the server-built conversation list whenever a message the user
 * can read is inserted (RLS limits realtime events to their conversations).
 */
export function ConversationListRefresher({ channelKey }: { channelKey: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-list:${channelKey}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 800);
      })
      .subscribe((status) => setState(channelState(status)));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [channelKey, router]);

  return null;
}
