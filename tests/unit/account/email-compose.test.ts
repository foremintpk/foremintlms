import { describe, expect, it } from "vitest";
import { composeEmail, escapeHtml, fillVars, listPlaceholders, safeUrl, type EmailContext, type EmailTemplateRecord } from "@/emails/compose";
import { redactPayload, samplePayload, TEMPLATE_VARIABLES, variablesFor } from "@/lib/services/email/templates";

const ctx: EmailContext = {
  brandName: "Foremint Academy",
  appUrl: "https://academy.example",
  logoUrl: "https://academy.example/brand/foremint-mark-256.png",
  supportEmail: "support@academy.example",
  legalEntityName: "Foremint Ltd",
  businessAddress: "1 Example Street",
  primaryColor: "#5B3DF5",
  preferencesUrl: "https://academy.example/learn/settings?tab=notifications",
};

const template: EmailTemplateRecord = {
  key: "communication.new_message",
  category: "communication",
  subject: "New message from {{sender_name}}",
  preheader: "{{preview}}",
  heading: "You have a new message",
  body: 'Hi {{first_name}},\n\n{{sender_name}} sent you a message:\n\n"{{preview}}"',
  cta_label: "Reply",
  is_required: false,
};

describe("fillVars", () => {
  it("replaces known variables and blanks unknown ones", () => {
    expect(fillVars("Hi {{ first_name }}, {{missing}}!", { first_name: "Amira" })).toBe("Hi Amira, !");
  });
  it("can show markers for previews", () => {
    expect(fillVars("{{course_title}}", {}, "marker")).toBe("[course title]");
  });
  it("lists placeholders once", () => {
    expect(listPlaceholders("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("safeUrl", () => {
  it("only allows http(s)", () => {
    expect(safeUrl("https://academy.example/x")).toBe("https://academy.example/x");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("/relative")).toBeNull();
    expect(safeUrl(123)).toBeNull();
  });
});

describe("composeEmail", () => {
  it("fills the subject, heading and body", () => {
    const email = composeEmail(template, { first_name: "Amira", sender_name: "Jordan", preview: "Great work", cta_url: "https://academy.example/learn/messages/1" }, ctx);
    expect(email.subject).toBe("New message from Jordan");
    expect(email.preheader).toBe("Great work");
    expect(email.html).toContain("Hi Amira,");
    expect(email.html).toContain('href="https://academy.example/learn/messages/1"');
    expect(email.text).toContain("Reply: https://academy.example/learn/messages/1");
  });

  it("escapes everything that comes from payloads", () => {
    const email = composeEmail(template, { sender_name: '<script>alert("x")</script>', preview: "<img src=x onerror=alert(1)>" }, ctx);
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("drops buttons for unsafe links", () => {
    const email = composeEmail(template, { cta_url: "javascript:alert(1)" }, ctx);
    expect(email.html).not.toContain("javascript:");
    expect(email.text).not.toContain("Reply:");
  });

  it("renders details and receipt tables", () => {
    const email = composeEmail(
      { ...template, key: "billing.payment_confirmation", category: "billing" },
      {
        details: [{ label: "Order", value: "FMA-R-2026-001042" }],
        line_items: [{ description: "Shopify Store Launch", amount: "$49.00" }],
        total: "$49.00",
      },
      ctx,
    );
    expect(email.html).toContain("FMA-R-2026-001042");
    expect(email.html).toContain("Shopify Store Launch");
    expect(email.html).toContain("Total");
    expect(email.text).toContain("Total: $49.00");
  });

  it("explains why required emails can't be unsubscribed from", () => {
    const required = composeEmail({ ...template, is_required: true }, {}, ctx);
    expect(required.html).toContain("concerns your account");
    expect(required.html).not.toContain("Manage email preferences");
    const optional = composeEmail(template, {}, ctx);
    expect(optional.html).toContain("Manage email preferences");
  });

  it("strips line breaks from subjects", () => {
    const email = composeEmail({ ...template, subject: "Hello\r\nBcc: someone@example.com" }, {}, ctx);
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it("includes legal entity details when configured", () => {
    expect(composeEmail(template, {}, ctx).html).toContain(escapeHtml("Foremint Ltd"));
    expect(composeEmail(template, {}, { ...ctx, legalEntityName: "", businessAddress: "" }).text).not.toContain("Foremint Ltd");
  });
});

describe("template catalog", () => {
  it("always offers brand variables", () => {
    expect(variablesFor("auth.welcome").map((v) => v.name)).toContain("brand_name");
  });
  it("provides sample data for every catalogued variable", () => {
    for (const key of Object.keys(TEMPLATE_VARIABLES)) {
      const payload = samplePayload(key, "https://academy.example");
      for (const v of TEMPLATE_VARIABLES[key]) expect(payload[v.name]).toBeTruthy();
    }
  });
  it("hides single-use sign-in links from staff", () => {
    expect(redactPayload("auth.password_reset", { cta_url: "https://x/auth/confirm?token_hash=abc" }).cta_url).not.toContain("token_hash");
    expect(redactPayload("communication.new_message", { cta_url: "https://x/m" }).cta_url).toBe("https://x/m");
  });
});
