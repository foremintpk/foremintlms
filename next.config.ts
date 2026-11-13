import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * The three PUBLIC values the browser needs. Either the NEXT_PUBLIC_ name or
 * the plain alias works (e.g. SUPABASE_URL), so hosting dashboards that
 * discourage the NEXT_PUBLIC_ prefix are fine. Never add secrets here: these
 * values are inlined into the JavaScript bundle.
 */
const PUBLIC_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
  ],
  NEXT_PUBLIC_APP_URL: ["NEXT_PUBLIC_APP_URL", "APP_URL"],
} as const;

function resolvePublicEnv(): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [name, candidates] of Object.entries(PUBLIC_VARS)) {
    const value = candidates.map((c) => process.env[c]?.trim()).find((v) => v);
    if (value) resolved[name] = value;
  }
  return resolved;
}

const publicEnvValues = resolvePublicEnv();

/**
 * Public pages are prerendered from Supabase at build time, so a build
 * without these variables cannot succeed. Fail immediately with a clear
 * message instead of a vague "Failed to collect page data" later.
 */
function assertBuildEnv() {
  const missing = (["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] as const)
    .filter((name) => !publicEnvValues[name])
    .map((name) => `${name} (or ${PUBLIC_VARS[name][1]})`);
  if (missing.length > 0) {
    throw new Error(
      `\n\nForemint Academy build: missing environment variable(s): ${missing.join(", ")}.\n` +
        "Add them in Vercel → Project → Settings → Environment Variables (Production and Preview), then redeploy.\n" +
        "See .env.example and docs/DEPLOYMENT.md for the full list.\n",
    );
  }
}

const supabaseHost = (() => {
  try {
    return new URL(publicEnvValues.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "avijlwhtadinxpfpddhi.supabase.co";
  }
})();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Inline the resolved public values under their NEXT_PUBLIC_ names.
  env: publicEnvValues,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Packages with native/Node-only internals used in route handlers.
  serverExternalPackages: ["@react-pdf/renderer", "sharp"],
  // Fonts and logo read from disk by PDF and OG-image routes must be bundled
  // into those serverless functions on Vercel.
  outputFileTracingIncludes: {
    "/api/certificates/[id]/pdf": [
      "./node_modules/@fontsource/funnel-display/files/*-latin-*-normal.woff",
      "./node_modules/@fontsource/funnel-sans/files/*-latin-*-normal.woff",
      "./public/brand/foremint-mark-256.png",
    ],
    "/api/billing/documents/[id]/pdf": [
      "./node_modules/@fontsource/funnel-display/files/*-latin-*-normal.woff",
      "./node_modules/@fontsource/funnel-sans/files/*-latin-*-normal.woff",
      "./public/brand/foremint-mark-256.png",
    ],
    "/**/opengraph-image*": ["./src/components/site/og/fonts/*"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "*.b-cdn.net" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) assertBuildEnv();
  return nextConfig;
}
