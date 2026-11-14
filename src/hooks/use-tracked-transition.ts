"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { beginBusy, claimTrigger, endBusy, holdProgress } from "@/lib/client/activity";

type StartTransition = ReturnType<typeof useTransition>[1];
type TransitionCallback = Parameters<StartTransition>[0];

interface Tracking {
  trigger: string | null;
  release: (() => void) | null;
}

function settle(t: Tracking) {
  if (t.trigger) endBusy(t.trigger);
  t.release?.();
  t.trigger = null;
  t.release = null;
}

/**
 * useTransition that shows its work: the Button that started the transition
 * gets a spinner while it is pending, and with `progress: true` (filters,
 * pagination — anything that changes the URL) the top progress bar runs too.
 * Drop-in replacement: returns `[pending, start]`.
 */
export function useTrackedTransition(options: { progress?: boolean } = {}): [boolean, (callback: TransitionCallback) => void] {
  const { progress = false } = options;
  const [pending, startTransition] = useTransition();
  const tracking = useRef<Tracking>({ trigger: null, release: null });
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
    if (!pending) settle(tracking.current);
  }, [pending]);

  useEffect(() => {
    const t = tracking.current;
    return () => settle(t);
  }, []);

  const start = useCallback(
    (callback: TransitionCallback) => {
      const t = tracking.current;
      settle(t);
      t.trigger = claimTrigger();
      if (t.trigger) beginBusy(t.trigger);
      if (progress) t.release = holdProgress();
      startTransition(callback);
      // A transition that schedules no update never reports pending; don't
      // leave its spinner running.
      setTimeout(() => {
        if (!pendingRef.current) settle(t);
      }, 250);
    },
    [progress],
  );

  return [pending, start];
}
