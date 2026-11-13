import { describe, expect, it } from "vitest";
import { slugify, formatMoney } from "@/lib/format";

describe("format helpers", () => {
  it("slugifies titles", () => {
    expect(slugify("Amazon FBA: From Zero & Beyond!")).toBe("amazon-fba-from-zero-and-beyond");
  });
  it("formats cents as currency", () => {
    expect(formatMoney(4900, "usd")).toBe("$49.00");
  });
});
