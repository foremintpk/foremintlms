import { describe, expect, it } from "vitest";
import { createOAuthState, OAUTH_STATE_MAX_AGE_SECONDS, safeReturnPath, verifyOAuthState } from "@/lib/services/live/oauth-state";

describe("OAuth state (CSRF protection)", () => {
  it("accepts the matching state from the same browser", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    const { state, cookieValue } = createOAuthState("/teach/settings?section=meetings", now);
    const result = verifyOAuthState(cookieValue, state, new Date(now.getTime() + 30_000));
    expect(result).toEqual({ ok: true, returnTo: "/teach/settings?section=meetings" });
  });

  it("rejects a state that doesn't match the cookie", () => {
    const { cookieValue } = createOAuthState("/teach/settings");
    const { state: other } = createOAuthState("/teach/settings");
    expect(verifyOAuthState(cookieValue, other)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a missing cookie or state", () => {
    const { state, cookieValue } = createOAuthState("/teach/settings");
    expect(verifyOAuthState(undefined, state)).toEqual({ ok: false, reason: "missing" });
    expect(verifyOAuthState(cookieValue, null)).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects an expired attempt", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    const { state, cookieValue } = createOAuthState("/teach/settings", now);
    const later = new Date(now.getTime() + (OAUTH_STATE_MAX_AGE_SECONDS + 1) * 1000);
    expect(verifyOAuthState(cookieValue, state, later)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a malformed cookie", () => {
    expect(verifyOAuthState("not-base64-json", "abc")).toEqual({ ok: false, reason: "malformed" });
  });

  it("generates a different state every time", () => {
    expect(createOAuthState("/teach").state).not.toBe(createOAuthState("/teach").state);
  });
});

describe("safeReturnPath", () => {
  it("keeps dashboard paths", () => {
    expect(safeReturnPath("/teach/settings?section=meetings")).toBe("/teach/settings?section=meetings");
    expect(safeReturnPath("/admin/live/accounts")).toBe("/admin/live/accounts");
  });

  it("refuses open redirects and other areas", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/learn/settings", "javascript:alert(1)", "", null]) {
      expect(safeReturnPath(bad)).toBe("/teach/settings?section=meetings");
    }
  });
});
