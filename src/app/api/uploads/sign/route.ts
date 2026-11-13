import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSignedUpload } from "@/lib/services/storage";

const schema = z.object({
  purpose: z.enum([
    "course_content",
    "course_image",
    "category_image",
    "marketing",
    "avatar",
    "submission",
    "message_attachment",
    "ticket_attachment",
    "live_resource",
    "document",
  ]),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  size: z.number().int().positive(),
  context: z
    .object({
      courseId: z.uuid().optional(),
      assignmentId: z.uuid().optional(),
      conversationId: z.uuid().optional(),
      ticketId: z.uuid().optional(),
      liveSessionId: z.uuid().optional(),
    })
    .default({}),
});

/** Validates an upload request and returns a short-lived signed upload URL. */
export async function POST(req: Request) {
  try {
    const user = await assertUser();
    await enforceRateLimit("upload-sign", 60, 600, user.id);
    const input = schema.parse(await req.json());
    const upload = await createSignedUpload(user, input);
    return NextResponse.json(upload, { headers: noStore });
  } catch (err) {
    return apiError(err);
  }
}
