import { describe, expect, it } from "vitest";
import { hasOpenDraft, missingPlaceholders, nextVersionNumber, planPublish } from "@/lib/services/admin/legal";
import { sectionValues, settingsRows, settingsSchemas } from "@/lib/services/admin/settings-schema";

describe("legal versioning", () => {
  const versions = [
    { id: "v1", version: 1, status: "superseded" as const },
    { id: "v2", version: 2, status: "published" as const },
    { id: "v3", version: 3, status: "draft" as const },
  ];

  it("numbers the next version after the highest existing one", () => {
    expect(nextVersionNumber(versions)).toBe(4);
    expect(nextVersionNumber([])).toBe(1);
  });

  it("publishing a draft supersedes the current published version only", () => {
    expect(planPublish(versions, "v3")).toEqual({ publishId: "v3", supersedeIds: ["v2"] });
  });

  it("refuses to publish anything other than a draft", () => {
    expect(() => planPublish(versions, "v2")).toThrow(/Only draft/);
    expect(() => planPublish(versions, "missing")).toThrow(/not found/);
  });

  it("detects open drafts", () => {
    expect(hasOpenDraft(versions)).toBe(true);
    expect(hasOpenDraft(versions.slice(0, 2))).toBe(false);
  });

  it("lists placeholders still waiting for a value", () => {
    const body = "<p>{{entity_name}} at {{business_address}}{{registration_number}} — {{support_email}}</p>";
    expect(missingPlaceholders(body, { entity_name: "Foremint Ltd", support_email: "" }).sort()).toEqual([
      "business_address",
      "support_email",
    ]);
  });
});

describe("settings schemas", () => {
  it("validates brand colours", () => {
    expect(settingsSchemas.brand.safeParse({ name: "Foremint", primary_color: "#5B3DF5", accent_color: "#3DDC97" }).success).toBe(true);
    expect(settingsSchemas.brand.safeParse({ name: "Foremint", primary_color: "violet", accent_color: "#3DDC97" }).success).toBe(false);
  });

  it("accepts an empty support email but rejects malformed ones", () => {
    const base = { phone: "", social_links: {} };
    expect(settingsSchemas.contact.safeParse({ ...base, support_email: "" }).success).toBe(true);
    expect(settingsSchemas.contact.safeParse({ ...base, support_email: "help@" }).success).toBe(false);
  });

  it("requires https social links", () => {
    const r = settingsSchemas.contact.safeParse({ support_email: "", phone: "", social_links: { linkedin: "http://linkedin.com/x" } });
    expect(r.success).toBe(false);
  });

  it("normalises live reminder offsets (unique, descending, max three)", () => {
    const r = settingsSchemas.learning.parse({ live_reminder_offsets_minutes: [60, 1440, 60], access_expiry_reminder_days: 7 });
    expect(r.live_reminder_offsets_minutes).toEqual([1440, 60]);
    expect(settingsSchemas.learning.safeParse({ live_reminder_offsets_minutes: [10, 20, 30, 40], access_expiry_reminder_days: 7 }).success).toBe(false);
  });

  it("rejects unknown upload extensions", () => {
    const r = settingsSchemas.uploads.safeParse({
      limits_mb: { course_content: 200, submission: 25, attachment: 10, image: 5 },
      allowed_extensions: { course_content: ["pdf", "exe"], submission: ["pdf"], attachment: ["pdf"] },
    });
    expect(r.success).toBe(false);
  });

  it("validates analytics identifiers", () => {
    expect(settingsSchemas.analytics.safeParse({ ga_measurement_id: "G-ABC1234", plausible_domain: "academy.example.com" }).success).toBe(true);
    expect(settingsSchemas.analytics.safeParse({ ga_measurement_id: "UA-123", plausible_domain: "" }).success).toBe(false);
  });

  it("maps sections to platform_settings rows and back", () => {
    const rows = settingsRows("security", { require_admin_mfa: true, allow_google_login: false });
    expect(rows).toEqual([
      expect.objectContaining({ key: "security.require_admin_mfa", value: true, is_public: false }),
      expect.objectContaining({ key: "security.allow_google_login", value: false, is_public: true }),
    ]);
    expect(sectionValues("security", { "security.require_admin_mfa": false })).toEqual({
      require_admin_mfa: false,
      allow_google_login: undefined,
    });
  });
});
