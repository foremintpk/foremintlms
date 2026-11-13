import { describe, expect, it } from "vitest";
import { backoffMinutes, redactError } from "@/lib/services/email/worker";
import { invitationState } from "@/lib/services/invitations";

describe("email retry backoff", () => {
  it("doubles each attempt and caps at six hours", () => {
    expect(backoffMinutes(1)).toBe(2);
    expect(backoffMinutes(2)).toBe(4);
    expect(backoffMinutes(5)).toBe(32);
    expect(backoffMinutes(20)).toBe(360);
    expect(backoffMinutes(0)).toBe(2);
  });

  it("redacts credentials from provider errors", () => {
    const message = redactError("401 invalid key re_AbCdEf123456789 Bearer eyJhbGciOi.abc.def");
    expect(message).not.toContain("re_AbCdEf123456789");
    expect(message).not.toContain("eyJhbGciOi");
    expect(redactError("x".repeat(1000)).length).toBe(400);
  });
});

describe("invitationState", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const base = { expires_at: "2026-11-20T00:00:00Z", accepted_at: null, revoked_at: null };

  it("is valid until it expires", () => {
    expect(invitationState(base, now)).toBe("valid");
    expect(invitationState({ ...base, expires_at: "2026-11-14T11:59:59Z" }, now)).toBe("expired");
  });

  it("reports used and withdrawn invitations", () => {
    expect(invitationState({ ...base, accepted_at: "2026-11-13T00:00:00Z" }, now)).toBe("accepted");
    expect(invitationState({ ...base, revoked_at: "2026-11-13T00:00:00Z" }, now)).toBe("revoked");
    expect(invitationState(null, now)).toBe("invalid");
  });
});
