import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { fontDisplay, fontMono, fontSans } from "./fonts";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Foremint Academy — Practical skills for the digital economy",
    template: "%s · Foremint Academy",
  },
  description:
    "Practical education for people building businesses, launching digital careers and creating opportunities in the modern economy.",
  applicationName: "Foremint Academy",
  openGraph: {
    type: "website",
    siteName: "Foremint Academy",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafd" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c1d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
