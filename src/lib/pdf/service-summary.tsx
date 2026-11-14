import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

/**
 * Foremint-branded service summary for a custom invoice (A4 portrait).
 *
 * Client-facing by design, so it carries only: the contact's name, company
 * name, company description, the company's services, the service
 * description, the included courses and the access period. It never shows
 * phone numbers, internal notes, addresses, account identifiers, tax fields
 * or pricing — the official Whop invoice is the financial record, and the
 * footer says so. It is never labelled as a Whop invoice.
 */

export interface ServiceSummaryData {
  reference: string;
  issuedOn: string;
  contactName: string;
  companyName: string | null;
  companyDescription: string | null;
  companyServices: string | null;
  serviceDescription: string;
  accessPeriod: string;
  accessDetail: string | null;
  courses: { title: string; category: string | null }[];
  includesFutureCourses: boolean;
  brandName: string;
  supportEmail: string | null;
}

const INK = "#15122E";
const BODY = "#3F3B5C";
const MUTED = "#6B6789";
const BRAND = "#5B3DF5";
const BRAND_DEEP = "#2A1BC9";
const SOFT = "#F5F3FF";
const LINE = "#E6E3F0";

let fontsReady: "custom" | "fallback" | null = null;

function fontFile(pkg: string, file: string) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "@fontsource", pkg, "files", file);
}

function ensureFonts(): "custom" | "fallback" {
  if (fontsReady) return fontsReady;
  const files = {
    sans400: fontFile("funnel-sans", "funnel-sans-latin-400-normal.woff"),
    sans600: fontFile("funnel-sans", "funnel-sans-latin-600-normal.woff"),
    display700: fontFile("funnel-display", "funnel-display-latin-700-normal.woff"),
  };
  if (Object.values(files).every((f) => fs.existsSync(f))) {
    Font.register({ family: "FunnelSans", fonts: [{ src: files.sans400, fontWeight: 400 }, { src: files.sans600, fontWeight: 600 }] });
    Font.register({ family: "FunnelDisplay", fonts: [{ src: files.display700, fontWeight: 700 }] });
    Font.registerHyphenationCallback((word) => [word]);
    fontsReady = "custom";
  } else {
    fontsReady = "fallback";
  }
  return fontsReady;
}

function loadMark(): Buffer | null {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "brand", "foremint-mark-256.png");
  try {
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  } catch {
    return null;
  }
}

function styles(fonts: "custom" | "fallback") {
  const sans = fonts === "custom" ? "FunnelSans" : "Helvetica";
  const display = fonts === "custom" ? "FunnelDisplay" : "Helvetica-Bold";
  const semibold = fonts === "custom" ? { fontFamily: "FunnelSans", fontWeight: 600 as const } : { fontFamily: "Helvetica-Bold" };
  return StyleSheet.create({
    page: { fontFamily: sans, fontSize: 9.5, color: BODY, paddingTop: 48, paddingBottom: 70, paddingHorizontal: 50, lineHeight: 1.5 },
    bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: BRAND },
    barDeep: { position: "absolute", top: 0, right: 0, width: 180, height: 6, backgroundColor: BRAND_DEEP },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 34 },
    brandRow: { flexDirection: "row", alignItems: "center" },
    mark: { width: 32, height: 32, marginRight: 9 },
    wordmark: { fontFamily: display, fontSize: 17, color: INK, letterSpacing: -0.4, lineHeight: 1 },
    wordmarkSub: { ...semibold, fontSize: 6.5, color: BRAND, letterSpacing: 2.6, marginTop: 2, lineHeight: 1 },
    docMeta: { alignItems: "flex-end" },
    docTitle: { fontFamily: display, fontSize: 13, color: INK, marginBottom: 3 },
    docLine: { fontSize: 8.5, color: MUTED, lineHeight: 1.35 },
    eyebrow: { ...semibold, fontSize: 8, color: BRAND, marginBottom: 6 },
    hero: { marginBottom: 26 },
    heroTitle: { fontFamily: display, fontSize: 24, color: INK, letterSpacing: -0.5, lineHeight: 1.18 },
    partyRow: { flexDirection: "row", gap: 16, marginBottom: 22 },
    partyCard: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 10, padding: 14 },
    label: { fontSize: 7.5, color: MUTED, marginBottom: 3 },
    strong: { ...semibold, fontSize: 11, color: INK },
    section: { marginBottom: 20 },
    sectionTitle: { fontFamily: display, fontSize: 12, color: INK, marginBottom: 6 },
    paragraph: { fontSize: 9.5, color: BODY, lineHeight: 1.55 },
    accessBox: { flexDirection: "row", backgroundColor: SOFT, borderRadius: 10, padding: 14, marginBottom: 24, alignItems: "center" },
    accessAccent: { width: 4, alignSelf: "stretch", backgroundColor: BRAND, borderRadius: 2, marginRight: 12 },
    accessText: { flex: 1 },
    accessValue: { fontFamily: display, fontSize: 14, color: INK },
    accessDetail: { fontSize: 8.5, color: MUTED, marginTop: 2 },
    courseHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
    count: { fontSize: 8.5, color: MUTED },
    grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
    cell: { width: "50%", paddingHorizontal: 4, paddingBottom: 8 },
    card: { flexDirection: "row", flexGrow: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, minHeight: 44 },
    num: { ...semibold, width: 20, height: 20, borderRadius: 10, backgroundColor: SOFT, color: BRAND, fontSize: 8, textAlign: "center", paddingTop: 4, marginRight: 9 },
    courseText: { flex: 1 },
    courseTitle: { ...semibold, fontSize: 9.5, color: INK, lineHeight: 1.3 },
    courseCategory: { fontSize: 7.5, color: MUTED, marginTop: 1 },
    future: { marginTop: 4, fontSize: 8.5, color: BRAND_DEEP },
    footer: { position: "absolute", left: 50, right: 50, bottom: 30, borderTopWidth: 1, borderColor: LINE, paddingTop: 9, flexDirection: "row", justifyContent: "space-between" },
    footerText: { fontSize: 7.2, color: MUTED, maxWidth: 400, lineHeight: 1.4 },
  });
}

function ServiceSummaryPdf({ d, mark, fonts }: { d: ServiceSummaryData; mark: Buffer | null; fonts: "custom" | "fallback" }) {
  const s = styles(fonts);
  return (
    <Document title={`Service summary ${d.reference}`} author={d.brandName} creator={d.brandName} producer={d.brandName}>
      <Page size="A4" style={s.page}>
        <View style={s.bar} fixed />
        <View style={s.barDeep} fixed />

        <View style={s.header}>
          <View style={s.brandRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images have no alt; the wordmark carries the name */}
            {mark ? <Image src={mark} style={s.mark} /> : null}
            <View>
              <Text style={s.wordmark}>Foremint</Text>
              <Text style={s.wordmarkSub}>ACADEMY</Text>
            </View>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docTitle}>Service summary</Text>
            <Text style={s.docLine}>Reference {d.reference}</Text>
            <Text style={s.docLine}>{d.issuedOn}</Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.eyebrow}>Training package</Text>
          <Text style={s.heroTitle}>{d.serviceDescription}</Text>
        </View>

        <View style={s.partyRow}>
          <View style={s.partyCard}>
            <Text style={s.label}>Prepared for</Text>
            <Text style={s.strong}>{d.contactName}</Text>
          </View>
          {d.companyName ? (
            <View style={s.partyCard}>
              <Text style={s.label}>Company</Text>
              <Text style={s.strong}>{d.companyName}</Text>
            </View>
          ) : null}
        </View>

        {d.companyDescription ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About {d.companyName ?? "the company"}</Text>
            <Text style={s.paragraph}>{d.companyDescription}</Text>
          </View>
        ) : null}
        {d.companyServices ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Services</Text>
            <Text style={s.paragraph}>{d.companyServices}</Text>
          </View>
        ) : null}

        <View style={s.accessBox} wrap={false}>
          <View style={s.accessAccent} />
          <View style={s.accessText}>
            <Text style={s.label}>Access period</Text>
            <Text style={s.accessValue}>{d.accessPeriod}</Text>
            {d.accessDetail ? <Text style={s.accessDetail}>{d.accessDetail}</Text> : null}
          </View>
        </View>

        <View style={s.courseHeadRow} minPresenceAhead={60}>
          <Text style={s.sectionTitle}>Included courses</Text>
          <Text style={s.count}>
            {d.courses.length} course{d.courses.length === 1 ? "" : "s"}
            {d.includesFutureCourses ? " + future releases" : ""}
          </Text>
        </View>
        <View style={s.grid}>
          {d.courses.map((c, i) => (
            <View key={`${c.title}-${i}`} style={s.cell} wrap={false}>
              <View style={s.card}>
                <Text style={s.num}>{i + 1}</Text>
                <View style={s.courseText}>
                  <Text style={s.courseTitle}>{c.title}</Text>
                  {c.category ? <Text style={s.courseCategory}>{c.category}</Text> : null}
                </View>
              </View>
            </View>
          ))}
        </View>
        {d.includesFutureCourses ? <Text style={s.future}>Every course published during the access period is included automatically.</Text> : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {d.brandName} service summary. This document describes the training service and is not a tax invoice; the payable amount,
            taxes and receipt are on the official invoice issued through Whop.{d.supportEmail ? ` Questions: ${d.supportEmail}` : ""}
          </Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderServiceSummaryPdf(data: ServiceSummaryData): Promise<Buffer> {
  const fonts = ensureFonts();
  return renderToBuffer(<ServiceSummaryPdf d={data} mark={loadMark()} fonts={fonts} />);
}
