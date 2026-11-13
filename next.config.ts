import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
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

export default nextConfig;
