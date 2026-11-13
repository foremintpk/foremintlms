/**
 * Email debouncing for chatty channels (messages, discussion replies).
 * One email per recipient per thread per time bucket; the bucket number is
 * part of the outbox idempotency key, so repeats inside a bucket are dropped.
 */

export const DEFAULT_BUCKET_MINUTES = 15;

export function debounceBucket(at: Date, minutes = DEFAULT_BUCKET_MINUTES): number {
  return Math.floor(at.getTime() / (minutes * 60_000));
}

/** Base key; notify() appends ":<recipientId>". */
export function messageEmailKey(conversationId: string, at: Date, minutes = DEFAULT_BUCKET_MINUTES): string {
  return `msg:${conversationId}:${debounceBucket(at, minutes)}`;
}

export function discussionReplyEmailKey(discussionId: string, at: Date, minutes = DEFAULT_BUCKET_MINUTES): string {
  return `disc-reply:${discussionId}:${debounceBucket(at, minutes)}`;
}

/**
 * Skip the email when the recipient has muted the thread or is reading it
 * right now (they read it within the active window).
 */
export function shouldEmailRecipient(input: {
  lastReadAt: string | null;
  isMuted: boolean;
  now: Date;
  activeWindowMinutes?: number;
}): boolean {
  if (input.isMuted) return false;
  if (!input.lastReadAt) return true;
  const read = Date.parse(input.lastReadAt);
  if (Number.isNaN(read)) return true;
  return input.now.getTime() - read > (input.activeWindowMinutes ?? 3) * 60_000;
}
