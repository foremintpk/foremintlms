import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderServiceSummaryPdf, type ServiceSummaryData } from "@/lib/pdf/service-summary";

const base: ServiceSummaryData = {
  reference: "FMA-INV-2026-001042",
  issuedOn: "14 November 2026",
  contactName: "John Smith",
  companyName: "ABC Digital Solutions",
  companyDescription: "ABC Digital Solutions helps independent brands launch and grow online stores across Europe and the Middle East.",
  companyServices: "Amazon account management, Shopify store builds, paid social campaigns and marketplace SEO.",
  serviceDescription: "Custom Digital Business Training Package — 2026",
  accessPeriod: "180 days",
  accessDetail: "Counted from the date payment is confirmed.",
  courses: [],
  includesFutureCourses: false,
  brandName: "Foremint Academy",
  supportEmail: "support@example.com",
};

describe("service summary PDF", () => {
  it("renders a valid A4 PDF with UTF-8 text", async () => {
    const pdf = await renderServiceSummaryPdf({
      ...base,
      contactName: "Zoë Ångström-Núñez",
      courses: [
        { title: "Amazon FBA Foundations", category: "E-commerce" },
        { title: "Shopify Store Launch", category: "E-commerce" },
        { title: "Digital Marketing Fundamentals", category: "Marketing" },
      ],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    if (process.env.SUMMARY_PDF_OUT) writeFileSync(process.env.SUMMARY_PDF_OUT, pdf);
  });

  it("wraps long course lists onto further pages", async () => {
    const courses = Array.from({ length: 40 }, (_, i) => ({ title: `Course ${i + 1}: a deliberately long title that has to wrap across two lines in its card`, category: i % 2 ? "Marketing" : null }));
    const pdf = await renderServiceSummaryPdf({ ...base, courses, includesFutureCourses: true, accessPeriod: "While the subscription is active", accessDetail: null });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    if (process.env.SUMMARY_PDF_OUT) writeFileSync(process.env.SUMMARY_PDF_OUT.replace(/\.pdf$/, "-long.pdf"), pdf);
  });
});
