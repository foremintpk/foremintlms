/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> renders into a PDF and has no alt attribute */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";

/**
 * Foremint-branded completion certificate (A4 landscape).
 * Fonts and the brand mark are read from disk; when they are unavailable
 * (e.g. not traced into a serverless bundle) the document falls back to the
 * built-in Helvetica so a certificate can always be produced.
 */

const ROOT = process.cwd();
const FONT_FILES = {
  display700: "node_modules/@fontsource/funnel-display/files/funnel-display-latin-700-normal.woff",
  display800: "node_modules/@fontsource/funnel-display/files/funnel-display-latin-800-normal.woff",
  sans400: "node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-400-normal.woff",
  sans600: "node_modules/@fontsource/funnel-sans/files/funnel-sans-latin-600-normal.woff",
};
const MARK_FILE = "public/brand/foremint-mark-256.png";

let fontsReady: boolean | null = null;

function registerFonts(): boolean {
  if (fontsReady !== null) return fontsReady;
  const abs = Object.fromEntries(Object.entries(FONT_FILES).map(([k, v]) => [k, path.join(ROOT, v)])) as Record<keyof typeof FONT_FILES, string>;
  if (!Object.values(abs).every((p) => fs.existsSync(p))) {
    fontsReady = false;
    return false;
  }
  Font.register({
    family: "Funnel Display",
    fonts: [
      { src: abs.display700, fontWeight: 700 },
      { src: abs.display800, fontWeight: 800 },
    ],
  });
  Font.register({
    family: "Funnel Sans",
    fonts: [
      { src: abs.sans400, fontWeight: 400 },
      { src: abs.sans600, fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
  return true;
}

function brandMark(): Buffer | null {
  const p = path.join(ROOT, MARK_FILE);
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

const INK = "#15122E";
const VIOLET = "#5B3DF5";
const MINT = "#0E9F6E";
const MUTED = "#615D80";
const LINE = "#E6E3F0";

export interface CertificatePdfInput {
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  instructorName: string | null;
  completionDate: string;
  issuedAt: string;
  verifyUrl: string;
  brandName: string;
}

function formatLongDate(value: string): string {
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

export async function renderCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  const custom = registerFonts();
  const display = custom ? "Funnel Display" : "Helvetica-Bold";
  const sans = custom ? "Funnel Sans" : "Helvetica";
  const sansBold = custom ? "Funnel Sans" : "Helvetica-Bold";
  const mark = brandMark();
  const qr = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: 220, color: { dark: INK, light: "#FFFFFF" } });

  const s = StyleSheet.create({
    page: { padding: 0, backgroundColor: "#FFFFFF", fontFamily: sans, color: INK },
    frame: {
      margin: 22,
      flexGrow: 1,
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 14,
      paddingHorizontal: 56,
      paddingVertical: 44,
      position: "relative",
    },
    band: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: VIOLET, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: { flexDirection: "row", alignItems: "center" },
    brandText: { fontFamily: display, fontWeight: 800, fontSize: 18, letterSpacing: -0.4, marginLeft: 10 },
    brandSub: { fontFamily: sans, fontSize: 12, color: MUTED, marginLeft: 4 },
    number: { fontSize: 9, color: MUTED },
    label: { fontSize: 11, color: MUTED, marginTop: 46 },
    title: { fontFamily: display, fontWeight: 800, fontSize: 40, letterSpacing: -1, marginTop: 6 },
    awarded: { fontSize: 12, color: MUTED, marginTop: 28 },
    recipient: { fontFamily: display, fontWeight: 700, fontSize: 34, marginTop: 6, color: VIOLET, letterSpacing: -0.6 },
    body: { fontSize: 12.5, lineHeight: 1.5, marginTop: 14, maxWidth: 520 },
    course: { fontFamily: sansBold, fontWeight: 600 },
    footer: { position: "absolute", left: 56, right: 56, bottom: 40, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    meta: { flexDirection: "row" },
    metaItem: { marginRight: 40 },
    metaLabel: { fontSize: 9, color: MUTED, marginBottom: 4 },
    metaValue: { fontSize: 12, fontFamily: sansBold, fontWeight: 600 },
    rule: { width: 160, height: 1, backgroundColor: INK, marginBottom: 6 },
    verify: { alignItems: "center" },
    verifyText: { fontSize: 8, color: MUTED, marginTop: 6, maxWidth: 150, textAlign: "center" },
    seal: { fontSize: 9, color: MINT, fontFamily: sansBold, fontWeight: 600, marginTop: 4 },
  });

  const doc = (
    <Document
      title={`Certificate ${input.certificateNumber}`}
      author={input.brandName}
      subject={`Certificate of completion — ${input.courseTitle}`}
      creator={input.brandName}
      producer={input.brandName}
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <View style={s.band} fixed />
          <View style={s.header}>
            <View style={s.brand}>
              {mark ? <Image src={mark} style={{ width: 34, height: 34 }} /> : null}
              <Text style={s.brandText}>foremint</Text>
              <Text style={s.brandSub}>academy</Text>
            </View>
            <Text style={s.number}>Certificate no. {input.certificateNumber}</Text>
          </View>

          <Text style={s.label}>Certificate of completion</Text>
          <Text style={s.title}>{input.courseTitle}</Text>

          <Text style={s.awarded}>Awarded to</Text>
          <Text style={s.recipient}>{input.recipientName}</Text>
          <Text style={s.body}>
            for successfully completing <Text style={s.course}>{input.courseTitle}</Text> at {input.brandName}, meeting the course
            completion requirements on {formatLongDate(input.completionDate)}.
          </Text>

          <View style={s.footer}>
            <View style={s.meta}>
              <View style={s.metaItem}>
                <View style={s.rule} />
                <Text style={s.metaLabel}>Date issued</Text>
                <Text style={s.metaValue}>{formatLongDate(input.issuedAt)}</Text>
              </View>
              {input.instructorName ? (
                <View style={s.metaItem}>
                  <View style={s.rule} />
                  <Text style={s.metaLabel}>Instructor</Text>
                  <Text style={s.metaValue}>{input.instructorName}</Text>
                </View>
              ) : null}
            </View>
            <View style={s.verify}>
              <Image src={qr} style={{ width: 74, height: 74 }} />
              <Text style={s.seal}>Verified certificate</Text>
              <Text style={s.verifyText}>{input.verifyUrl}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
