import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import { CertificateLookupForm } from "@/components/site/forms";
import { Container } from "@/components/site/primitives";
import { isValidCertificateNumber } from "@/lib/domain/certificates";
import { formatDate } from "@/lib/format";
import { sha256 } from "@/lib/security/crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

export const metadata: Metadata = {
  title: "Certificate verification",
  robots: { index: false, follow: false },
};

interface PublicCertificate {
  id: string;
  certificate_number: string;
  recipient_name: string;
  course_title: string;
  instructor_name: string | null;
  completion_date: string;
  issued_at: string;
  status: "issued" | "revoked";
  revoked_at: string | null;
}

type Lookup = { state: "invalid" } | { state: "limited" } | { state: "not_found" } | { state: "found"; cert: PublicCertificate };

async function lookup(raw: string): Promise<Lookup> {
  const number = decodeURIComponent(raw).trim().toUpperCase();
  if (!isValidCertificateNumber(number)) return { state: "invalid" };
  const meta = await getRequestMeta();
  if (!(await checkRateLimit(`certificate-verify:${meta.ip ?? "unknown"}`, 30, 300))) return { state: "limited" };

  const admin = createAdminClient();
  // Only fields intended to be public are selected.
  const { data, error } = await admin
    .from("certificates")
    .select("id, certificate_number, recipient_name, course_title, instructor_name, completion_date, issued_at, status, revoked_at")
    .eq("certificate_number", number)
    .maybeSingle();
  if (error) throw new Error(`certificate lookup failed: ${error.message}`);
  if (!data) return { state: "not_found" };

  const day = new Date().toISOString().slice(0, 10);
  await admin.from("certificate_verifications").insert({
    certificate_id: data.id,
    // Daily-salted hash: lets us count distinct verifiers without storing IPs.
    ip_hash: meta.ip ? sha256(`${meta.ip}|${day}`) : null,
    user_agent: meta.userAgent,
  });
  return { state: "found", cert: data as PublicCertificate };
}

export default async function CertificateResultPage({ params }: PageProps<"/certificates/verify/[number]">) {
  const { number } = await params;
  const result = await lookup(number);

  return (
    <Container className="max-w-2xl py-16 sm:py-24">
      {result.state === "found" && result.cert.status === "issued" ? (
        <div className="rounded-3xl border border-success/30 bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <BadgeCheck className="size-8 text-success" aria-hidden />
            <div>
              <p className="text-sm font-medium text-success">Verified certificate</p>
              <h1 className="text-2xl font-semibold tracking-tight">Issued by Foremint Academy</h1>
            </div>
          </div>
          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Awarded to</dt>
              <dd className="mt-1 text-lg font-semibold">{result.cert.recipient_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Course</dt>
              <dd className="mt-1 text-lg font-semibold">{result.cert.course_title}</dd>
            </div>
            {result.cert.instructor_name ? (
              <div>
                <dt className="text-sm text-muted-foreground">Instructor</dt>
                <dd className="mt-1 font-medium">{result.cert.instructor_name}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-muted-foreground">Completed</dt>
              <dd className="mt-1 font-medium">{formatDate(result.cert.completion_date)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Issued</dt>
              <dd className="mt-1 font-medium">{formatDate(result.cert.issued_at)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Certificate number</dt>
              <dd className="mt-1 font-mono text-sm font-medium">{result.cert.certificate_number}</dd>
            </div>
          </dl>
        </div>
      ) : result.state === "found" ? (
        <div className="rounded-3xl border border-destructive/30 bg-card p-6 sm:p-8">
          <ShieldX className="size-8 text-destructive" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">This certificate has been revoked</h1>
          <p className="mt-2 text-muted-foreground">
            Certificate {result.cert.certificate_number} for {result.cert.course_title} is no longer valid
            {result.cert.revoked_at ? ` as of ${formatDate(result.cert.revoked_at)}` : ""}.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <ShieldAlert className="size-8 text-warning" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {result.state === "limited" ? "Too many lookups" : result.state === "invalid" ? "That isn't a valid certificate number" : "No certificate found"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {result.state === "limited"
              ? "Wait a few minutes and try again."
              : result.state === "invalid"
                ? "Certificate numbers look like FMA-2026-7K3Q9XPA. Check the number on the certificate and try again."
                : "We couldn't find a certificate with that number. Check it for typos — letters O and I are never used."}
          </p>
          <div className="mt-6">
            <CertificateLookupForm />
          </div>
        </div>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/certificates/verify" className="font-medium text-primary hover:underline">
          Verify another certificate
        </Link>
      </p>
    </Container>
  );
}
