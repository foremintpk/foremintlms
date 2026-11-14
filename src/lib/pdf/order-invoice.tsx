import "server-only";
import { Document, Image, Link, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatMinor } from "@/lib/domain/invoicing";
import { ensureFonts, loadLogo, makeStyles, MUTED, SOFT } from "./receipt";

/**
 * Invoice for a course-package order (A4), in the same branded layout as
 * Foremint receipts. Generated on demand from the order snapshot: the
 * courses and prices are frozen when the order is placed, and the status
 * badge (Paid / Unpaid / …) reflects the order's verified payment state.
 */

export type OrderInvoiceStatus = "paid" | "unpaid" | "refunded" | "partially_refunded" | "cancelled" | "expired" | "under_review";

export interface OrderInvoiceModel {
  number: string;
  status: OrderInvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  currency: string;
  learnerEmail: string;
  payerEmail: string | null;
  accessLabel: string;
  items: { title: string; category: string | null; amountMinor: number }[];
  subtotalMinor: number;
  discountMinor: number;
  couponCode: string | null;
  taxMinor: number | null;
  totalMinor: number;
  payUrl: string | null;
  seller: { brandName: string; legalEntityName: string; addressLines: string[]; registrationNumber: string; supportEmail: string };
}

const BADGE: Record<OrderInvoiceStatus, { text: string; bg: string; fg: string }> = {
  paid: { text: "PAID", bg: "#E3F9EF", fg: "#0E9F6E" },
  unpaid: { text: "UNPAID", bg: "#FFF4DD", fg: "#B86E00" },
  refunded: { text: "REFUNDED", bg: SOFT, fg: MUTED },
  partially_refunded: { text: "PARTIALLY REFUNDED", bg: "#FFF4DD", fg: "#B86E00" },
  cancelled: { text: "CANCELLED", bg: SOFT, fg: MUTED },
  expired: { text: "EXPIRED", bg: SOFT, fg: MUTED },
  under_review: { text: "PAYMENT UNDER REVIEW", bg: "#FFF4DD", fg: "#B86E00" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

function OrderInvoicePdf({ m, logo, fonts }: { m: OrderInvoiceModel; logo: Buffer | null; fonts: "custom" | "fallback" }) {
  const st = makeStyles(fonts);
  const money = (minor: number) => formatMinor(minor, m.currency);
  const badge = BADGE[m.status];
  const sellerName = m.seller.legalEntityName || m.seller.brandName;
  const paid = m.status === "paid" || m.status === "partially_refunded" || m.status === "refunded";

  return (
    <Document title={`Invoice ${m.number}`} author={m.seller.brandName} creator={m.seller.brandName}>
      <Page size="A4" style={st.page}>
        <View style={st.brandBar} fixed />
        <View style={st.header}>
          <View style={st.brandRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={st.logo} /> : null}
            <View>
              <Text style={st.wordmark}>Foremint</Text>
              <Text style={st.wordmarkSuffix}>ACADEMY</Text>
            </View>
          </View>
          <View style={st.titleBlock}>
            <Text style={st.title}>Invoice</Text>
            <Text style={st.number}>{m.number}</Text>
            <Text style={[st.badge, { backgroundColor: badge.bg, color: badge.fg }]}>{badge.text}</Text>
          </View>
        </View>

        <View style={st.metaRow}>
          <View style={st.metaCell}>
            <Text style={st.label}>Invoice date</Text>
            <Text style={st.value}>{fmtDate(m.issuedAt)}</Text>
          </View>
          <View style={st.metaCell}>
            <Text style={st.label}>{paid ? "Paid on" : "Pay by"}</Text>
            <Text style={st.value}>{paid ? fmtDate(m.paidAt) : fmtDate(m.dueAt)}</Text>
          </View>
          <View style={st.metaCell}>
            <Text style={st.label}>Access</Text>
            <Text style={st.value}>{m.accessLabel}</Text>
          </View>
          <View style={st.metaCell}>
            <Text style={st.label}>Payment reference</Text>
            <Text style={st.value}>{m.paymentReference ?? "—"}</Text>
          </View>
        </View>

        <View style={st.parties}>
          <View style={st.party}>
            <Text style={st.label}>Student</Text>
            <Text style={st.partyName}>{m.learnerEmail}</Text>
            {m.payerEmail && m.payerEmail !== m.learnerEmail ? <Text style={st.muted}>Paid by {m.payerEmail}</Text> : null}
          </View>
          <View style={st.party}>
            <Text style={st.label}>From</Text>
            <Text style={st.partyName}>{sellerName}</Text>
            {m.seller.legalEntityName && m.seller.legalEntityName !== m.seller.brandName ? <Text style={st.muted}>Trading as {m.seller.brandName}</Text> : null}
            {m.seller.addressLines.map((l) => (
              <Text key={l} style={st.muted}>
                {l}
              </Text>
            ))}
            {m.seller.registrationNumber ? <Text style={st.muted}>Company no. {m.seller.registrationNumber}</Text> : null}
            {m.seller.supportEmail ? <Text style={st.muted}>{m.seller.supportEmail}</Text> : null}
          </View>
        </View>

        <View style={st.tableHead}>
          <Text style={[st.th, st.colDesc]}>Course</Text>
          <Text style={[st.th, st.colUnit]}>Access</Text>
          <Text style={[st.th, st.colAmount]}>Amount</Text>
        </View>
        {m.items.map((item) => (
          <View key={item.title} style={st.tr} wrap={false}>
            <View style={st.colDesc}>
              <Text>{item.title}</Text>
              {item.category ? <Text style={st.muted}>{item.category}</Text> : null}
            </View>
            <Text style={st.colUnit}>{m.accessLabel}</Text>
            <Text style={st.colAmount}>{money(item.amountMinor)}</Text>
          </View>
        ))}

        <View style={st.totals}>
          <View style={st.totalRow}>
            <Text style={st.muted}>Subtotal</Text>
            <Text>{money(m.subtotalMinor)}</Text>
          </View>
          {m.discountMinor > 0 ? (
            <View style={st.totalRow}>
              <Text style={st.muted}>Discount{m.couponCode ? ` (${m.couponCode})` : ""}</Text>
              <Text>−{money(m.discountMinor)}</Text>
            </View>
          ) : null}
          {m.taxMinor ? (
            <View style={st.totalRow}>
              <Text style={st.muted}>Tax (calculated by Whop)</Text>
              <Text>{money(m.taxMinor)}</Text>
            </View>
          ) : null}
          <View style={st.grandTotal}>
            <Text style={st.grandLabel}>{paid ? "Total paid" : "Total due"}</Text>
            <Text style={st.grandValue}>{money(m.totalMinor + (m.taxMinor ?? 0))}</Text>
          </View>
        </View>

        <View style={st.note}>
          {paid ? (
            <Text>Thank you — this invoice is paid. Payment was processed securely by Whop{m.paymentReference ? ` (reference ${m.paymentReference})` : ""}.</Text>
          ) : m.status === "unpaid" && m.payUrl ? (
            <Text>
              Pay securely online with Whop:{" "}
              <Link src={m.payUrl} style={{ color: "#5B3DF5" }}>
                {m.payUrl}
              </Link>
              . Any applicable tax is calculated by Whop at checkout. Anyone can pay this invoice; the courses go to the student email above.
            </Text>
          ) : (
            <Text>This invoice can no longer be paid online. Contact us if you need a new payment link.</Text>
          )}
        </View>

        <Text style={st.footer} fixed>
          {m.seller.brandName} · Invoice {m.number} · Generated from the order record; prices are frozen when the order is placed.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderOrderInvoicePdf(model: OrderInvoiceModel, origin: string): Promise<Buffer> {
  const fonts = ensureFonts();
  const logo = await loadLogo(origin);
  return renderToBuffer(<OrderInvoicePdf m={model} logo={logo} fonts={fonts} />);
}
