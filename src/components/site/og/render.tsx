import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Static assets: read once per server instance.
const fontDir = join(process.cwd(), "src/components/site/og/fonts");
const displayFont = readFile(join(fontDir, "funnel-display-latin-700-normal.woff"));
const textFont = readFile(join(fontDir, "funnel-sans-latin-500-normal.woff"));

function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#5B3DF5" />
      <rect x="16" y="13" width="10" height="38" rx="5" fill="#FFFFFF" />
      <rect x="16" y="13" width="31" height="10" rx="5" fill="#FFFFFF" />
      <path d="M24.5 42.5C26 31.5 35 26.5 48 27.5C47 39 37.5 44.5 24.5 42.5Z" fill="#3DDC97" />
    </svg>
  );
}

/** Brand social card: wordmark, a large title and a supporting line. */
export async function renderOgImage({ title, eyebrow, footer }: { title: string; eyebrow?: string | null; footer?: string | null }) {
  const [display, text] = await Promise.all([displayFont, textFont]);
  const clipped = title.length > 90 ? `${title.slice(0, 87)}…` : title;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#FAFAFD",
          fontFamily: "Funnel Sans",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: "radial-gradient(closest-side, rgba(91,61,245,0.22), rgba(91,61,245,0))",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark size={60} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "Funnel Display", fontSize: 40, color: "#15122E", letterSpacing: -1.5 }}>foremint</span>
            <span style={{ fontSize: 28, color: "#615D80" }}>academy</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {eyebrow ? <span style={{ fontSize: 30, color: "#5B3DF5" }}>{eyebrow}</span> : null}
          <span style={{ fontFamily: "Funnel Display", fontSize: clipped.length > 50 ? 64 : 80, lineHeight: 1.02, color: "#15122E", letterSpacing: -2.5, maxWidth: 1000 }}>
            {clipped}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 120, height: 8, borderRadius: 8, background: "#E6E3F0", display: "flex" }}>
            <div style={{ width: 76, height: 8, borderRadius: 8, background: "#3DDC97" }} />
          </div>
          <span style={{ fontSize: 26, color: "#615D80" }}>{footer ?? "Practical skills for the digital economy"}</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Funnel Display", data: display, weight: 700, style: "normal" },
        { name: "Funnel Sans", data: text, weight: 500, style: "normal" },
      ],
    },
  );
}
