import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Award, Download, Eye } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/learning/copy-button";
import { requireUser } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = { title: "Certificates" };

export default function CertificatesPage() {
  return (
    <>
      <PageHeader title="Certificates" description="Download your certificates or share a link anyone can use to verify them." />
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
        <CertificateList />
      </Suspense>
    </>
  );
}

async function CertificateList() {
  const user = await requireUser("/learn/certificates");
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select("id, certificate_number, course_title, instructor_name, completion_date, issued_at, status, courses(slug)")
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });
  const certs = (data ?? []) as unknown as {
    id: string;
    certificate_number: string;
    course_title: string;
    instructor_name: string | null;
    completion_date: string;
    issued_at: string;
    status: "issued" | "revoked";
    courses: { slug: string } | null;
  }[];

  if (certs.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No certificates yet"
        description="Complete a course's requirements to earn a certificate. Each course page shows exactly what's left."
        action={
          <Button asChild variant="outline">
            <Link href="/learn/courses">Go to my courses</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {certs.map((c) => (
        <li key={c.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-strong">
              <Award className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg leading-snug font-semibold">{c.course_title}</h2>
              <p className="text-sm text-muted-foreground">
                Completed <LocalTime value={`${c.completion_date}T00:00:00Z`} format="date" />
                {c.instructor_name ? ` · ${c.instructor_name}` : ""}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{c.certificate_number}</p>
            </div>
          </div>
          {c.status === "revoked" ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">This certificate has been revoked. Contact support for details.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={`/api/certificates/${c.id}/pdf?download=1`}>
                  <Download /> Download PDF
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noopener">
                  <Eye /> View
                </a>
              </Button>
              <CopyButton value={appUrl(`/certificates/verify/${c.certificate_number}`)} label="Copy verify link" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
