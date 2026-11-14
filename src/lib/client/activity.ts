/**
 * Tiny client-side store that connects user intent to visible progress:
 *
 * - **Busy buttons.** A Button records itself as the "trigger" when clicked
 *   (including the synthetic click browsers fire when Enter submits a form).
 *   The action that starts right after claims that trigger and marks it busy
 *   until the action settles, so exactly the button the user pressed shows a
 *   spinner, without every call site wiring a `loading` prop.
 * - **Top progress bar.** Link clicks and URL-changing transitions (filters,
 *   pagination) hold the bar until the new URL is committed.
 *
 * State lives at module level and is read through useSyncExternalStore.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
const emit = () => {
  for (const l of listeners) l();
};

export function subscribeActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ── Busy buttons ────────────────────────────────────────────────────────────

/** A click only counts as the trigger of an action that starts this soon after it. */
const TRIGGER_WINDOW_MS = 600;

let lastTrigger: { id: string; at: number } | null = null;
const busy = new Map<string, number>();

export function markTrigger(id: string) {
  lastTrigger = { id, at: Date.now() };
}

/** Take the button that was just pressed, if any. Each click is claimed once. */
export function claimTrigger(): string | null {
  if (!lastTrigger || Date.now() - lastTrigger.at > TRIGGER_WINDOW_MS) return null;
  const { id } = lastTrigger;
  lastTrigger = null;
  return id;
}

export function beginBusy(id: string) {
  busy.set(id, (busy.get(id) ?? 0) + 1);
  emit();
}

export function endBusy(id: string) {
  const n = (busy.get(id) ?? 0) - 1;
  if (n > 0) busy.set(id, n);
  else busy.delete(id);
  emit();
}

export function isBusy(id: string): boolean {
  return busy.has(id);
}

// ── Top progress bar ────────────────────────────────────────────────────────

let holds = 0;

/** Keep the progress bar running until the returned release function is called. */
export function holdProgress(): () => void {
  holds += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    emit();
  };
}

export function isProgressActive(): boolean {
  return holds > 0;
}
