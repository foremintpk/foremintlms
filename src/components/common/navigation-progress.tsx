"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { holdProgress, isProgressActive, subscribeActivity } from "@/lib/client/activity";

/** Give up on a navigation that never commits (offline, cancelled). */
const MAX_NAVIGATION_MS = 20_000;

/** Is this click an in-app navigation to a different URL? Returns its target. */
function navigationTarget(event: MouseEvent): URL | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // Same page (or only the #hash differs): nothing to load.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url;
}

/**
 * Thin bar at the top of the window while the next page loads. It starts on
 * any in-app link click and on transitions that hold progress (filters,
 * pagination), and finishes when the URL changes — the moment the new page
 * or its loading skeleton is on screen. In development, routes are compiled
 * on first visit and never prefetched, so this is often the only feedback.
 */
export function NavigationProgress() {
  const active = useSyncExternalStore(subscribeActivity, isProgressActive, () => false);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    setPhase(active ? "loading" : "done");
  }

  // Let the "done" sweep play, then reset.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setPhase("idle"), 450);
    return () => clearTimeout(t);
  }, [phase]);

  // Link clicks hold the bar until the address bar changes.
  useEffect(() => {
    let release: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let giveUp: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (poll) clearInterval(poll);
      if (giveUp) clearTimeout(giveUp);
      poll = giveUp = null;
      release?.();
      release = null;
    };

    const onClick = (event: MouseEvent) => {
      if (!navigationTarget(event)) return;
      finish();
      const from = window.location.href;
      release = holdProgress();
      poll = setInterval(() => {
        if (window.location.href !== from) finish();
      }, 80);
      giveUp = setTimeout(finish, MAX_NAVIGATION_MS);
    };

    // Capture phase: read the URL before the router starts navigating.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", finish);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", finish);
      finish();
    };
  }, []);

  return <div aria-hidden className="nav-progress" data-state={phase} />;
}
