/**
 * Pure helpers shared by auth forms (client) and auth actions (server).
 */

/**
 * Only allow same-site relative paths as post-login destinations, so a
 * crafted `?next=` can never send someone to another site.
 */
export function safeNextPath(next: unknown, fallback = "/learn"): string {
  if (typeof next !== "string") return fallback;
  const value = next.trim();
  if (value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/^\/[^/]*:/.test(value)) return fallback;
  // Never bounce back into auth screens after signing in.
  if (/^\/(login|register|forgot-password|reset-password|verify-email)(\/|\?|$)/.test(value)) return fallback;
  return value;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  hints: string[];
}

const COMMON = ["password", "123456", "12345678", "qwerty", "letmein", "welcome", "admin", "iloveyou", "foremint", "academy", "abc123", "111111", "monkey", "dragon"];

export const MIN_PASSWORD_LENGTH = 10;

export function passwordStrength(password: string, context: string[] = []): PasswordStrength {
  const hints: string[] = [];
  const pw = password ?? "";
  const lower = pw.toLowerCase();
  let score = 0;

  if (pw.length >= MIN_PASSWORD_LENGTH) score++;
  else hints.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (pw.length >= 14) score++;

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score++;
  else hints.push("Mix upper and lower case letters, numbers and symbols.");

  const repetitive = /^(.)\1+$/.test(pw) || /(012|123|234|345|456|567|678|789|abc|bcd|cde)/i.test(pw);
  const common = COMMON.some((c) => lower.includes(c));
  const personal = context
    .map((c) => c.toLowerCase().trim())
    .filter((c) => c.length >= 3)
    .some((c) => lower.includes(c));
  if (!repetitive && !common && !personal) score++;
  else hints.push(personal ? "Avoid using your name or email in your password." : "Avoid common words and sequences.");

  if (pw.length < MIN_PASSWORD_LENGTH) score = Math.min(score, 1);
  const clamped = Math.max(0, Math.min(4, score)) as PasswordStrength["score"];
  const labels: PasswordStrength["label"][] = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];
  return { score: clamped, label: labels[clamped], hints };
}

/** Minimum acceptable strength enforced on the server. */
export function isPasswordAcceptable(password: string, context: string[] = []): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= 128 && passwordStrength(password, context).score >= 2;
}

/** Coarse device label from a user agent, used for "new sign-in" notices and session lists. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

/** Token-hash link types we accept on /auth/confirm. */
export const CONFIRM_TYPES = ["signup", "email", "magiclink", "recovery", "invite", "email_change"] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export function isConfirmType(value: unknown): value is ConfirmType {
  return typeof value === "string" && (CONFIRM_TYPES as readonly string[]).includes(value);
}
