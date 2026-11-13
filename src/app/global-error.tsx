"use client";

import { useEffect } from "react";

/** Last-resort boundary: replaces the root layout, so styles are inline. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAFD",
          color: "#15122E",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Foremint Academy is having trouble</h1>
          <p style={{ color: "#615D80", lineHeight: 1.5 }}>
            Something went wrong while loading the site. Please try again in a moment
            {error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#5B3DF5", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
