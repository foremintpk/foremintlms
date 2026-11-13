import localFont from "next/font/local";

// Self-hosted so builds never depend on reaching Google Fonts.
export const fontDisplay = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/funnel-display/files/funnel-display-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/funnel-display/files/funnel-display-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/funnel-display/files/funnel-display-latin-700-normal.woff2", weight: "700" },
    { path: "../../node_modules/@fontsource/funnel-display/files/funnel-display-latin-800-normal.woff2", weight: "800" },
  ],
});

export const fontSans = localFont({
  variable: "--font-text",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-600-normal.woff2", weight: "600" },
    { path: "../../node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-700-normal.woff2", weight: "700" },
  ],
});

export const fontMono = localFont({
  variable: "--font-code",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2", weight: "500" },
  ],
});
