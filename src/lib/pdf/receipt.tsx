import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/format";
import type { ReceiptSnapshot } from "@/lib/services/billing/receipt-model";

/**
 * Foremint-branded receipt / credit note (A4). Rendered from the frozen
 * document snapshot, never from live data. The document states clearly that
 * Foremint generated it from a Whop payment; it is not a Whop document.
 */

const INK = "#15122E";
const MUTED = "#615D80";
const BRAND = "#5B3DF5";
const LINE = "#E6E3F0";
const SOFT = "#F3F2F8";

let fontsReady: "custom" | "fallback" | null = null;

function fontPath(pkg: string, file: string) {
  return path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file);
}

function ensureFonts(): "custom" | "fallback" {
  if (fontsReady) return fontsReady;
  const files = {
    sans400: fontPath("funnel-sans", "funnel-sans-latin-400-normal.woff"),
    sans600: fontPath("funnel-sans", "funnel-sans-latin-600-normal.woff"),
    display700: fontPath("funnel-display", "funnel-display-latin-700-normal.woff"),
  };
  if (Object.values(files).every((f) => fs.existsSync(f))) {
    Font.register({
      family: "FunnelSans",
      fonts: [
        { src: files.sans400, fontWeight: 400 },
        { src: files.sans600, fontWeight: 600 },
      ],
    });
    Font.register({ family: "FunnelDisplay", fonts: [{ src: files.display700, fontWeight: 700 }] });
    Font.registerHyphenationCallback((word) => [word]);
    fontsReady = "custom";
  } else {
    fontsReady = "fallback";
  }
  return fontsReady;
}

async function loadLogo(origin: string): Promise<Buffer | null> {
  const local = path.join(process.cwd(), "public", "brand", "foremint-mark-256.png");
  try {
    if (fs.existsSync(local)) return fs.readFileSync(local);
    const res = await fetch(`${origin}/brand/foremint-mark-256.png`);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {
    // The receipt still renders without the mark.
  }
  return null;
}

function makeStyles(fonts: "custom" | "fallback") {
  const sans = fonts === "custom" ? "FunnelSans" : "Helvetica";
  const display = fonts === "custom" ? "FunnelDisplay" : "Helvetica-Bold";
  const bold = fonts === "custom" ? { fontFamily: "FunnelSans", fontWeight: 600 as const } : { fontFamily: "Helvetica-Bold" };
  return StyleSheet.create({
    brandBar: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: BRAND },
    page: { fontFamily: sans, fontSize: 9.5, color: INK, paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48, lineHeight: 1.45 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
    brandRow: { flexDirection: "row", alignItems: "center" },
    logo: { width: 30, height: 30, marginRight: 9 },
    wordmark: { fontFamily: display, fontSize: 17, color: INK, letterSpacing: -0.4, lineHeight: 1 },
    wordmarkSuffix: { ...bold, fontSize: 6.5, color: BRAND, letterSpacing: 2.6, marginTop: 2, lineHeight: 1 },
    titleBlock: { alignItems: "flex-end" },
    title: { fontFamily: display, fontSize: 20, color: INK, letterSpacing: -0.3, lineHeight: 1.15, marginBottom: 4 },
    number: { color: MUTED, lineHeight: 1.3 },
    badge: { marginTop: 6, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 8, fontSize: 8.5, ...bold },
    metaRow: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE, paddingVertical: 10, marginBottom: 22 },
    metaCell: { flex: 1 },
    label: { fontSize: 7.5, color: MUTED, marginBottom: 2, letterSpacing: 0.2 },
    value: { ...bold },
    parties: { flexDirection: "row", marginBottom: 24 },
    party: { flex: 1, paddingRight: 16 },
    partyName: { ...bold, marginBottom: 1 },
    muted: { color: MUTED },
    tableHead: { flexDirection: "row", backgroundColor: SOFT, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 4 },
    th: { fontSize: 8, color: MUTED, ...bold },
    tr: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: LINE },
    colDesc: { flex: 1 },
    colQty: { width: 50, textAlign: "right" },
    colUnit: { width: 80, textAlign: "right" },
    colAmount: { width: 86, textAlign: "right" },
    totals: { marginTop: 14, marginLeft: "auto", width: 236 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    grandTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderColor: INK, paddingTop: 7, marginTop: 4 },
    grandLabel: { ...bold, fontSize: 11 },
    grandValue: { fontFamily: display, fontSize: 13 },
    note: { marginTop: 24, padding: 10, backgroundColor: SOFT, borderRadius: 6, color: MUTED, fontSize: 8.5 },
    warn: { marginTop: 8, color: "#B86E00", fontSize: 8.5 },
    footer: { position: "absolute", left: 48, right: 48, bottom: 28, borderTopWidth: 1, borderColor: LINE, paddingTop: 8, fontSize: 7.5, color: MUTED },
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

function statusLabel(status: string): { text: string; bg: string; fg: string } {
  switch (status) {
    case "paid":
    case "succeeded":
      return { text: "Paid", bg: "#E3F9EF", fg: "#0E9F6E" };
    case "refunded":
      return { text: "Refunded", bg: SOFT, fg: MUTED };
    case "partially_refunded":
      return { text: "Partially refunded", bg: "#FFF4DD", fg: "#B86E00" };
    default:
      return { text: status.replace(/_/g, " "), bg: SOFT, fg: MUTED };
  }
}

function ReceiptPdf({ s, logo, fonts }: { s: ReceiptSnapshot; logo: Buffer | null; fonts: "custom" | "fallback" }) {
  const st = makeStyles(fonts);
  const money = (cents: number) => formatMoney(cents, s.currency);
  const isCredit = s.kind === "credit_note";
  const status = statusLabel(isCredit ? s.paymentStatus : s.paymentStatus);
  const sellerName = s.seller.legalEntityName || s.seller.brandName;

  return (
    <Document title={`${isCredit ? "Credit note" : "Receipt"} ${s.number}`} author={s.seller.brandName} creator={s.seller.brandName}>
      <Page size="A4" style={st.page}>
        <View style={st.brandBar} fixed />
        <View style={st.header}>
          <View style={st.brandRow}>
            {/* react-pdf images have no alt attribute; the wordmark beside it carries the name. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={st.logo} /> : null}
            <View>
              <Text style={st.wordmark}>Foremint</Text>
              <Text style={st.wordmarkSuffix}>ACADEMY</Text>
            </View>
          </View>
          <View style={st.titleBlock}>
            <Text style={st.title}>{isCredit ? "Credit note" : "Receipt"}</Text>
            <Text style={st.number}>{s.number}</Text>
            <Text style={[st.badge, { backgroundColor: status.bg, color: status.fg }]}>{status.text}</Text>
          </View>
        </View>

        <View style={st.metaRow}>
          <View style={st.metaCell}>
            <Text style={st.label}>{isCredit ? "Issued" : "Receipt date"}</Text>
            <Text style={st.value}>{fmtDate(s.issuedAt)}</Text>
          </View>
          <View style={st.metaCell}>
            <Text style={st.label}>Payment date</Text>
            <Text style={st.value}>{fmtDate(s.paidAt)}</Text>
          </View>
          <View style={st.metaCell}>
            <Text style={st.label}>Payment reference</Text>
            <Text style={st.value}>{s.whopPaymentId}</Text>
          </View>
          {isCredit && s.relatesTo ? (
            <View style={st.metaCell}>
              <Text style={st.label}>Relates to receipt</Text>
              <Text style={st.value}>{s.relatesTo}</Text>
            </View>
          ) : (
            <View style={st.metaCell}>
              <Text style={st.label}>Payment method</Text>
              <Text style={st.value}>{s.paymentMethod ?? "—"}</Text>
            </View>
          )}
        </View>

        <View style={st.parties}>
          <View style={st.party}>
            <Text style={st.label}>Billed to</Text>
            <Text style={st.partyName}>{s.customer.name ?? s.customer.email ?? "Customer"}</Text>
            {s.customer.name && s.customer.email ? <Text style={st.muted}>{s.customer.email}</Text> : null}
            {s.customer.addressLines.map((l) => (
              <Text key={l} style={st.muted}>
                {l}
              </Text>
            ))}
          </View>
          <View style={st.party}>
            <Text style={st.label}>From</Text>
            <Text style={st.partyName}>{sellerName}</Text>
            {s.seller.legalEntityName && s.seller.legalEntityName !== s.seller.brandName ? (
              <Text style={st.muted}>Trading as {s.seller.brandName}</Text>
            ) : null}
            {s.seller.addressLines.map((l) => (
              <Text key={l} style={st.muted}>
                {l}
              </Text>
            ))}
            {s.seller.registrationNumber ? <Text style={st.muted}>Company no. {s.seller.registrationNumber}</Text> : null}
            {s.seller.taxId ? <Text style={st.muted}>Tax ID {s.seller.taxId}</Text> : null}
          </View>
        </View>

        <View style={st.tableHead}>
          <Text style={[st.th, st.colDesc]}>Description</Text>
          <Text style={[st.th, st.colQty]}>Qty</Text>
          <Text style={[st.th, st.colUnit]}>Unit price</Text>
          <Text style={[st.th, st.colAmount]}>Amount</Text>
        </View>
        {s.lines.map((line, i) => (
          <View key={i} style={st.tr} wrap={false}>
            <View style={st.colDesc}>
              <Text style={st.value}>{line.description}</Text>
              {line.detail ? <Text style={st.muted}>{line.detail}</Text> : null}
              {i === 0 && s.billingPeriod ? <Text style={st.muted}>{s.billingPeriod}</Text> : null}
            </View>
            <Text style={st.colQty}>{line.quantity}</Text>
            <Text style={st.colUnit}>{money(line.unitAmountCents)}</Text>
            <Text style={st.colAmount}>{money(line.unitAmountCents * line.quantity)}</Text>
          </View>
        ))}

        <View style={st.totals}>
          <View style={st.totalRow}>
            <Text style={st.muted}>Subtotal</Text>
            <Text>{money(s.subtotalCents)}</Text>
          </View>
          {s.discountCents > 0 ? (
            <View style={st.totalRow}>
              <Text style={st.muted}>Discount{s.promoCodeId ? " (promo code)" : ""}</Text>
              <Text>−{money(s.discountCents)}</Text>
            </View>
          ) : null}
          {s.taxCents !== null ? (
            <View style={st.totalRow}>
              <Text style={st.muted}>Tax{s.taxBehavior === "inclusive" ? " (included in price)" : ""}</Text>
              <Text>{money(s.taxCents)}</Text>
            </View>
          ) : null}
          <View style={st.grandTotal}>
            <Text style={st.grandLabel}>{isCredit ? "Total paid" : `Total (${s.currency.toUpperCase()})`}</Text>
            <Text style={st.grandValue}>{money(isCredit ? s.providerTotalCents ?? s.subtotalCents : s.totalCents)}</Text>
          </View>
          {isCredit ? (
            <View style={st.grandTotal}>
              <Text style={st.grandLabel}>Refunded</Text>
              <Text style={st.grandValue}>{money(s.refundedCents)}</Text>
            </View>
          ) : null}
        </View>

        {s.totalsMismatch ? (
          <Text style={st.warn}>
            The total shown is the amount Whop charged ({money(s.providerTotalCents ?? s.totalCents)}). It differs from the sum of the
            line items above because of a discount, tax or currency adjustment reported by the payment provider.
          </Text>
        ) : null}

        <View style={st.note}>
          <Text>
            This {isCredit ? "credit note" : "receipt"} was generated by {s.seller.brandName} from Whop payment {s.whopPaymentId}. Payments are
            processed by Whop; Whop&apos;s own receipt for this payment is available from your billing page.
            {s.taxCents === null ? " No tax was charged on this payment by the payment provider." : ""}
          </Text>
        </View>

        <View style={st.footer} fixed>
          <Text>
            {[sellerName, s.seller.supportEmail ? `Questions? ${s.seller.supportEmail}` : null, s.seller.footer].filter(Boolean).join("   —   ")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(snapshot: ReceiptSnapshot, origin: string): Promise<Buffer> {
  const fonts = ensureFonts();
  const logo = await loadLogo(origin);
  return renderToBuffer(<ReceiptPdf s={snapshot} logo={logo} fonts={fonts} />);
}
