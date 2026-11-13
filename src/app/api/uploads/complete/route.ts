import { NextResponse } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/auth/guards";
import { apiError, noStore } from "@/lib/api";
import { finalizeUpload, PUBLIC_BUCKETS } from "@/lib/services/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ mediaFileId: z.uuid() });

/** Verifies the uploaded object (size + file signature) and marks it ready. */
export async function POST(req: Request) {
  try {
    const user = await assertUser();
    const { mediaFileId } = schema.parse(await req.json());
    const file = await finalizeUpload(user, mediaFileId);
    const publicUrl = PUBLIC_BUCKETS.has(file.bucket)
      ? createAdminClient().storage.from(file.bucket).getPublicUrl(file.storage_path).data.publicUrl
      : null;
    return NextResponse.json(
      { id: file.id, fileName: file.file_name, mimeType: file.mime_type, size: file.size_bytes, publicUrl },
      { headers: noStore },
    );
  } catch (err) {
    return apiError(err);
  }
}
