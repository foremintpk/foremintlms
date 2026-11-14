"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import type { AdvisorPublicConfig } from "@/lib/domain/advisor-view";
import { cn } from "@/lib/utils";
import { AdvisorAvatar } from "./advisor-avatar";
import { ADVISOR_OPEN_EVENT } from "./open-advisor-button";

// The conversation panel is loaded only when a visitor opens the advisor.
const AdvisorPanel = dynamic(() => import("./advisor-panel").then((m) => m.AdvisorPanel), { ssr: false });

const NUDGE_KEY = "fm-advisor-nudge-dismissed";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable: the nudge simply shows again next time */
  }
}

/**
 * Bottom-left course advisor launcher. Sits below the cookie banner (z-index)
 * and lifts above the mobile package bar via --fm-floating-offset, so it never
 * covers consent or checkout controls.
 */
export function AdvisorWidget({ config }: { config: AdvisorPublicConfig }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const show = useCallback((message?: string | null) => {
    setMounted(true);
    setOpen(true);
    setNudge(false);
    writeFlag(NUDGE_KEY);
    if (message) setPending(message);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => show((e as CustomEvent<{ message?: string }>).detail?.message ?? null);
    window.addEventListener(ADVISOR_OPEN_EVENT, onOpen);
    // A gentle, one-time introduction after the visitor has had a look around.
    const timer = window.setTimeout(() => {
      if (!readFlag(NUDGE_KEY)) setNudge(true);
    }, 6000);
    return () => {
      window.removeEventListener(ADVISOR_OPEN_EVENT, onOpen);
      window.clearTimeout(timer);
    };
  }, [show]);

  if (!config.enabled) return null;

  return (
    <>
      {mounted ? (
        <AdvisorPanel
          config={config}
          open={open}
          onMinimize={() => setOpen(false)}
          pendingMessage={pending}
          onPendingConsumed={() => setPending(null)}
        />
      ) : null}
      <div
        className={cn(
          "fixed bottom-[calc(1rem+var(--fm-floating-offset,0px))] left-4 z-40 flex flex-col-reverse items-start gap-2.5 transition-[opacity,bottom] duration-300 sm:left-6 lg:bottom-6",
          open && "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => show()}
          aria-expanded={open}
          aria-controls="course-advisor-panel"
          aria-label="Chat with the Foremint course advisor chatbot"
          className="group flex items-center gap-3 rounded-full border border-primary/15 bg-card/95 p-1.5 shadow-raised backdrop-blur outline-none transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 focus-visible:ring-4 focus-visible:ring-ring/40 sm:pr-5"
          data-testid="advisor-launcher"
        >
          <AdvisorAvatar size="md" className="rounded-full transition-transform duration-300 group-hover:scale-105" />
          <span className="text-left leading-tight max-sm:hidden">
            <span className="block text-sm font-semibold text-foreground">Chat with us</span>
            <span className="block text-xs text-muted-foreground">Course advisor chatbot</span>
          </span>
        </button>
        {nudge ? (
          <div className="relative ml-1 max-w-[230px] animate-rise rounded-2xl rounded-bl-md border bg-popover py-2.5 pr-8 pl-3 text-sm shadow-raised" role="status">
            <button type="button" onClick={() => show()} className="text-left">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">
                <Bot className="size-3" aria-hidden /> Chatbot
              </span>
              <span className="mt-1 block leading-snug font-semibold text-foreground">Need help choosing a course?</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setNudge(false);
                writeFlag(NUDGE_KEY);
              }}
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
            <span aria-hidden className="absolute -bottom-[7px] left-5 size-3 rotate-45 border-r border-b bg-popover" />
          </div>
        ) : null}
      </div>
    </>
  );
}
