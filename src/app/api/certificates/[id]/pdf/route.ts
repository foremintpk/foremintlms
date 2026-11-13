import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser, getCourseRole } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { appUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";
import { getCertificate } from "@/lib/services/certificates";
import { renderCertificatePdf } from "@/lib/pdf/certificate";

/** Certificate PDF for its owner, the course's staff, or an administrator. */
export async function GET(req: Request, ctx: RouteContext<"/api/certificates/[id]/pdf">) {
  try {
    const user = await assertUser();
    const { id } = await ctx.params;
    const cert = await getCertificate(z.uuid().parse(id));
    if (!cert) return NextResponse.json({ error: "Certificate not found." }, { status: 404, headers: noStore });
    if (cert.user_id !== user.id) {
      const role = await getCourseRole(user, cert.course_id);
      if (!role.isAdmin && !role.isInstructor) {
        return NextResponse.json({ error: "You don't have access to this certificate." }, { status: 403, headers: noStore });
      }
    }
    if (cert.status !== "issued") {
      return NextResponse.json({ error: "This certificate has been revoked." }, { status: 410, headers: noStore });
    }
    const settings = await getPublicSettings();
    const pdf = await renderCertificatePdf({
      certificateNumber: cert.certificate_number,
      recipientName: cert.recipient_name,
      courseTitle: cert.course_title,
      instructorName: cert.instructor_name,
      completionDate: cert.completion_date,
      issuedAt: cert.issued_at,
      verifyUrl: appUrl(`/certificates/verify/${cert.certificate_number}`),
      brandName: settings.brandName,
    });
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="foremint-certificate-${cert.certificate_number}.pdf"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
