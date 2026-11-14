import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Static assets: read once per server instance.
const fontDir = join(process.cwd(), "src/components/site/og/fonts");
const displayFont = readFile(join(fontDir, "funnel-display-latin-700-normal.woff"));
const textFont = readFile(join(fontDir, "funnel-sans-latin-500-normal.woff"));
const markPng = readFile(join(process.cwd(), "public/brand/foremint-mark-256.png"));

function Mark({ size = 64, src }: { size?: number; src: string }) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered by next/og (satori), not the browser
  return <img src={src} width={size} height={size} />;
}

/** Brand social card: wordmark, a large title and a supporting line. */
export async function renderOgImage({ title, eyebrow, footer }: { title: string; eyebrow?: string | null; footer?: string | null }) {
  const [display, text, mark] = await Promise.all([displayFont, textFont, markPng]);
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
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
          <Mark size={64} src={markSrc} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: "Funnel Display", fontSize: 42, lineHeight: 1, color: "#15122E", letterSpacing: -1.5 }}>Foremint</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "#5B3DF5", letterSpacing: 7 }}>
              <span style={{ width: 18, height: 2, background: "rgba(91,61,245,0.5)" }} />
              ACADEMY
              <span style={{ width: 18, height: 2, background: "rgba(91,61,245,0.5)" }} />
            </span>
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
