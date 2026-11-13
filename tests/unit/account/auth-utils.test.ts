import { describe, expect, it } from "vitest";
import {
  describeUserAgent,
  isConfirmType,
  isPasswordAcceptable,
  passwordStrength,
  safeNextPath,
} from "@/components/auth/utils";

describe("safeNextPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeNextPath("/learn/courses/shopify?tab=1")).toBe("/learn/courses/shopify?tab=1");
    expect(safeNextPath("/invite/abc123")).toBe("/invite/abc123");
  });

  it("rejects open redirects and odd input", () => {
    expect(safeNextPath("https://evil.example")).toBe("/learn");
    expect(safeNextPath("//evil.example/path")).toBe("/learn");
    expect(safeNextPath("/\\evil.example")).toBe("/learn");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/learn");
    expect(safeNextPath("/learn\u0000")).toBe("/learn");
    expect(safeNextPath(undefined)).toBe("/learn");
    expect(safeNextPath(42)).toBe("/learn");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/learn");
  });

  it("never sends people back into auth screens", () => {
    expect(safeNextPath("/login")).toBe("/learn");
    expect(safeNextPath("/register?next=/x")).toBe("/learn");
    expect(safeNextPath("/reset-password", "/admin")).toBe("/admin");
  });

  it("uses the supplied fallback", () => {
    expect(safeNextPath("http://x", "")).toBe("");
  });
});

describe("passwordStrength", () => {
  it("scores short passwords as too weak", () => {
    const s = passwordStrength("abc");
    expect(s.score).toBeLessThanOrEqual(1);
    expect(s.hints.length).toBeGreaterThan(0);
  });

  it("rewards length and variety", () => {
    expect(passwordStrength("Correct-Horse-Battery-9").score).toBe(4);
  });

  it("penalises common words and personal details", () => {
    expect(passwordStrength("Password12345!").score).toBeLessThan(4);
    const personal = passwordStrength("AmiraHaddad#2024x", ["Amira Haddad", "amira"]);
    expect(personal.hints.join(" ")).toMatch(/name or email/);
  });

  it("enforces the server minimum", () => {
    expect(isPasswordAcceptable("short1!")).toBe(false);
    expect(isPasswordAcceptable("aaaaaaaaaaaa")).toBe(false);
    expect(isPasswordAcceptable("Tide-Lantern-42")).toBe(true);
    expect(isPasswordAcceptable("x".repeat(129))).toBe(false);
  });
});

describe("describeUserAgent", () => {
  it("summarises common browsers", () => {
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe(
      "Chrome on Windows",
    );
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe(
      "Safari on iOS",
    );
    expect(describeUserAgent(null)).toBe("Unknown device");
  });
});

describe("isConfirmType", () => {
  it("accepts only supported token types", () => {
    expect(isConfirmType("signup")).toBe(true);
    expect(isConfirmType("recovery")).toBe(true);
    expect(isConfirmType("sms")).toBe(false);
    expect(isConfirmType(undefined)).toBe(false);
  });
});
