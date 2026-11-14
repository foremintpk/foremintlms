"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTrackedTransition } from "./use-tracked-transition";

export type ClientActionResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Call a server action, track pending state, surface field errors and show a
 * toast with the action's own message ("Course saved", "Ticket closed").
 */
export function useAction<I, T>(
  action: (input: I) => Promise<ClientActionResult<T>>,
  opts: { successMessage?: string; onSuccess?: (data: T) => void; silent?: boolean } = {},
) {
  // The pressed Button shows a spinner while the action runs (see lib/client/activity).
  const [pending, startTransition] = useTrackedTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (input: I) =>
      new Promise<ClientActionResult<T>>((resolve) => {
        startTransition(async () => {
          setError(null);
          setFieldErrors({});
          try {
            const result = await action(input);
            if (result.ok) {
              const message = result.message ?? opts.successMessage;
              if (message && !opts.silent) toast.success(message);
              opts.onSuccess?.(result.data);
            } else {
              setError(result.error);
              setFieldErrors(result.fieldErrors ?? {});
              if (!opts.silent) toast.error(result.error);
            }
            resolve(result);
          } catch (err) {
            // Redirects thrown by actions propagate through Next.js; anything
            // else is a network or unexpected failure.
            if (err && typeof err === "object" && "digest" in err) throw err;
            const message = "We couldn't reach the server. Check your connection and try again.";
            setError(message);
            if (!opts.silent) toast.error(message);
            resolve({ ok: false, error: message });
          }
        });
      }),
    [action, opts, startTransition],
  );

  return { run, pending, error, fieldErrors, setFieldErrors };
}

/** Convert FormData into a plain object; repeated keys become arrays. */
export function formToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (value instanceof File) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}
