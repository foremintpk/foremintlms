import { z } from "zod";

/**
 * Environment configuration.
 *
 * Public values (NEXT_PUBLIC_*) are inlined at build time and safe for the
 * browser. Everything else is read lazily on the server only — importing
 * `serverEnv()` from client code fails the build via `server-only` in the
 * modules that use it.
 */

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid public environment variables: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}. See .env.example.`,
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  CRON_SECRET: z.string().min(16),

  WHOP_API_KEY: optional,
  WHOP_COMPANY_ID: optional,
  WHOP_WEBHOOK_SECRET: optional,
  WHOP_ENVIRONMENT: z.enum(["production", "sandbox"]).default("production"),

  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,
  EMAIL_FROM: optional,
  SUPPORT_EMAIL: optional,

  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_WEBHOOK_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,

  BUNNY_STREAM_LIBRARY_ID: optional,
  BUNNY_STREAM_API_KEY: optional,
  BUNNY_STREAM_TOKEN_KEY: optional,
  BUNNY_STREAM_CDN_HOSTNAME: optional,
  BUNNY_WEBHOOK_SECRET: optional,

  ZOOM_CLIENT_ID: optional,
  ZOOM_CLIENT_SECRET: optional,
  ZOOM_REDIRECT_URI: optional,
  ZOOM_WEBHOOK_SECRET_TOKEN: optional,

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REDIRECT_URI: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServer: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must never be called in the browser");
  }
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse({
    ...process.env,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Missing or invalid server environment variables: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} (${i.message})`)
        .join(", ")}. See .env.example.`,
    );
  }
  cachedServer = parsed.data;
  return cachedServer;
}

export function appUrl(path = ""): string {
  const base = publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;
}
