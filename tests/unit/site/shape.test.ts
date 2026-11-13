import { describe, expect, it } from "vitest";
import {
  averageRating,
  buildOutline,
  escapeHtml,
  fillRegistrationNumber,
  legalPlaceholderValues,
  parseCatalogQuery,
  serializeJsonLd,
  sortPlans,
  summarizeCoursePrice,
  toPublicPlan,
  type RawPlan,
} from "@/lib/services/public/shape";

const NOW = new Date("2026-11-14T12:00:00Z");

function plan(overrides: Partial<RawPlan> = {}): RawPlan {
  return {
    id: "p1",
    product_id: "prod",
    name: "Lifetime",
    description: null,
    plan_type: "one_time",
    currency: "usd",
    price_cents: 4900,
    compare_at_price_cents: null,
    access_duration_days: null,
    billing_period_days: null,
    trial_days: null,
    stock_limit: null,
    units_sold: 0,
    available_from: null,
    available_until: null,
    promo_label: null,
    visibility: "public",
    is_featured: false,
    sort_order: 0,
    ...overrides,
  };
}

describe("toPublicPlan", () => {
  it("labels a lifetime one-time plan", () => {
    const p = toPublicPlan(plan(), NOW);
    expect(p.available).toBe(true);
    expect(p.priceLabel).toBe("$49");
    expect(p.accessLabel).toBe("Lifetime access");
    expect(p.remaining).toBeNull();
  });

  it("labels a monthly subscription and trial", () => {
    const p = toPublicPlan(plan({ plan_type: "recurring", price_cents: 1900, billing_period_days: 30, trial_days: 7 }), NOW);
    expect(p.priceLabel).toBe("$19 / month");
    expect(p.accessLabel).toContain("7-day free trial");
  });

  it("marks sold-out, ended and future plans unavailable", () => {
    expect(toPublicPlan(plan({ stock_limit: 10, units_sold: 10 }), NOW).unavailableReason).toBe("sold_out");
    expect(toPublicPlan(plan({ available_until: "2026-11-01T00:00:00Z" }), NOW).unavailableReason).toBe("ended");
    expect(toPublicPlan(plan({ available_from: "2026-12-01T00:00:00Z" }), NOW).unavailableReason).toBe("not_started");
  });

  it("reports remaining stock", () => {
    expect(toPublicPlan(plan({ stock_limit: 25, units_sold: 20 }), NOW).remaining).toBe(5);
  });
});

describe("summarizeCoursePrice", () => {
  it("returns Free for free courses", () => {
    expect(summarizeCoursePrice(true, []).priceLabel).toBe("Free");
  });

  it("returns Free when a free plan is available", () => {
    const free = toPublicPlan(plan({ plan_type: "free", price_cents: 0, access_duration_days: 30 }), NOW);
    expect(summarizeCoursePrice(false, [free])).toEqual({ priceLabel: "Free", accessLabel: "30 days of access" });
  });

  it("uses the cheapest available plan with a From prefix when several exist", () => {
    const a = toPublicPlan(plan({ id: "a", price_cents: 9900 }), NOW);
    const b = toPublicPlan(plan({ id: "b", price_cents: 2900, access_duration_days: 30 }), NOW);
    expect(summarizeCoursePrice(false, [a, b])).toEqual({ priceLabel: "From $29", accessLabel: "30 days of access" });
  });

  it("ignores unavailable plans and returns null when nothing is purchasable", () => {
    const soldOut = toPublicPlan(plan({ stock_limit: 1, units_sold: 1 }), NOW);
    expect(summarizeCoursePrice(false, [soldOut])).toEqual({ priceLabel: null, accessLabel: null });
  });
});

describe("sortPlans", () => {
  it("orders by sort_order, then price", () => {
    const sorted = sortPlans([
      { id: "x", sort_order: 1, price_cents: 100 },
      { id: "y", sort_order: 0, price_cents: 900 },
      { id: "z", sort_order: 0, price_cents: 500 },
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["z", "y", "x"]);
  });
});

describe("averageRating", () => {
  it("returns null without valid ratings", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([0, 7])).toBeNull();
  });
  it("rounds to one decimal", () => {
    expect(averageRating([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});

describe("buildOutline", () => {
  it("groups lessons by module in order and drops empty modules", () => {
    const outline = buildOutline(
      [
        { id: "m2", title: "Two", description: null, sort_order: 2 },
        { id: "m1", title: "One", description: null, sort_order: 1 },
        { id: "m3", title: "Empty", description: null, sort_order: 3 },
      ],
      [
        { id: "l2", module_id: "m1", title: "B", lesson_type: "video", sort_order: 2, duration_minutes: 5, is_preview: false },
        { id: "l1", module_id: "m1", title: "A", lesson_type: "video", sort_order: 1, duration_minutes: 3, is_preview: true },
        { id: "l3", module_id: "m2", title: "C", lesson_type: "quiz", sort_order: 1, duration_minutes: null, is_preview: false },
      ],
    );
    expect(outline.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(outline[0].lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
  });
});

describe("parseCatalogQuery", () => {
  it("whitelists values and defaults sort/page", () => {
    expect(parseCatalogQuery({ level: "expert", price: "cheap", sort: "random", category: "Bad Slug!", page: "-3" })).toEqual({
      q: "",
      category: null,
      level: null,
      price: null,
      sort: "featured",
      page: 1,
    });
  });
  it("accepts valid filters", () => {
    expect(parseCatalogQuery({ q: "  shopify ", level: "beginner", price: "free", sort: "newest", category: "shopify", page: "2" })).toEqual({
      q: "shopify",
      category: "shopify",
      level: "beginner",
      price: "free",
      sort: "newest",
      page: 2,
    });
  });
});

describe("legal placeholders", () => {
  it("renders the registration number inline or not at all", () => {
    expect(fillRegistrationNumber("Registered at X{{registration_number}}.", "12345")).toBe("Registered at X, registration no. 12345.");
    expect(fillRegistrationNumber("Registered at X{{ registration_number }}.", "")).toBe("Registered at X.");
  });
  it("escapes the registration number", () => {
    expect(fillRegistrationNumber("{{registration_number}}", "<b>1</b>")).toBe(", registration no. &lt;b&gt;1&lt;/b&gt;");
  });
  it("maps settings to placeholder keys", () => {
    const v = legalPlaceholderValues({ legalEntityName: "Acme Ltd", businessAddress: "1 Road", supportEmail: "a@b.co", jurisdiction: "England and Wales", siteUrl: "https://x.test" });
    expect(v).toEqual({ entity_name: "Acme Ltd", business_address: "1 Road", support_email: "a@b.co", jurisdiction: "England and Wales", site_url: "https://x.test" });
  });
});

describe("escapeHtml / serializeJsonLd", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
  it("prevents breaking out of a script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
  it("escapes line and paragraph separators", () => {
    const out = serializeJsonLd({ t: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c` });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).t).toBe(`a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`);
  });
});
