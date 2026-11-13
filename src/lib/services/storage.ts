import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { getCourseRole } from "@/lib/auth/guards";
import { UserFacingError } from "@/lib/actions";
import type { SessionUser } from "@/lib/auth/session";

export type UploadPurpose =
  | "course_content"
  | "course_image"
  | "category_image"
  | "marketing"
  | "avatar"
  | "submission"
  | "message_attachment"
  | "ticket_attachment"
  | "live_resource"
  | "document";

export interface UploadContext {
  courseId?: string;
  assignmentId?: string;
  conversationId?: string;
  ticketId?: string;
  liveSessionId?: string;
}

const BUCKET: Record<UploadPurpose, string> = {
  course_content: "course-content",
  live_resource: "course-content",
  course_image: "public-media",
  category_image: "public-media",
  marketing: "public-media",
  avatar: "avatars",
  submission: "submissions",
  message_attachment: "attachments",
  ticket_attachment: "attachments",
  document: "documents",
};

export const PUBLIC_BUCKETS = new Set(["public-media", "avatars"]);

const LIMIT_KEY: Record<UploadPurpose, "course_content" | "submission" | "attachment" | "image"> = {
  course_content: "course_content",
  live_resource: "course_content",
  course_image: "image",
  category_image: "image",
  marketing: "image",
  avatar: "image",
  submission: "submission",
  message_attachment: "attachment",
  ticket_attachment: "attachment",
  document: "attachment",
};

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

export const EXT_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  avif: ["image/avif"],
  mp3: ["audio/mpeg"],
};

/** Leading bytes that identify binary formats; used to reject renamed files. */
const MAGIC: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  webp: [[0x52, 0x49, 0x46, 0x46]],
  zip: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  pptx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
  ppt: [[0xd0, 0xcf, 0x11, 0xe0]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  mp3: [[0x49, 0x44, 0x33], [0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]],
};

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function safeFileName(name: string): string {
  const ext = fileExtension(name);
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

export function matchesMagic(ext: string, head: Uint8Array): boolean {
  const sigs = MAGIC[ext];
  if (!sigs) return true; // text formats have no signature
  return sigs.some((sig) => sig.every((b, i) => head[i] === b));
}

async function allowedExtensions(purpose: UploadPurpose): Promise<string[]> {
  if (LIMIT_KEY[purpose] === "image") return IMAGE_EXT;
  if (purpose === "document") return ["pdf"];
  const all = await getSetting<Record<string, string[]>>("uploads.allowed_extensions", {});
  const key = LIMIT_KEY[purpose];
  return all[key] ?? ["pdf", "png", "jpg", "jpeg"];
}

async function maxBytes(purpose: UploadPurpose): Promise<number> {
  const limits = await getSetting<Record<string, number>>("uploads.limits_mb", {});
  const mb = limits[LIMIT_KEY[purpose]] ?? 10;
  return mb * 1024 * 1024;
}

/** Throws unless the user may upload a file for this purpose and context. */
async function authorizeUpload(user: SessionUser, purpose: UploadPurpose, ctx: UploadContext): Promise<string | null> {
  const admin = createAdminClient();
  switch (purpose) {
    case "course_content":
    case "course_image":
    case "live_resource": {
      if (!ctx.courseId) throw new UserFacingError("Choose a course first.");
      const role = await getCourseRole(user, ctx.courseId);
      const allowed = purpose === "live_resource" ? role.isAdmin || role.isInstructor : role.canEdit;
      if (!allowed) throw new UserFacingError("You cannot upload files to this course.");
      return ctx.courseId;
    }
    case "category_image":
    case "marketing":
    case "document": {
      const role = user.roles.includes("admin");
      if (!role) throw new UserFacingError("Only administrators can upload these files.");
      return null;
    }
    case "avatar":
      return null;
    case "submission": {
      if (!ctx.assignmentId) throw new UserFacingError("Missing assignment.");
      const supabase = await createClient();
      // RLS: the assignment row is only visible to learners with course access.
      const { data } = await supabase
        .from("assignments")
        .select("id, course_id, status")
        .eq("id", ctx.assignmentId)
        .maybeSingle();
      if (!data || data.status !== "published") throw new UserFacingError("This assignment is not available.");
      return data.course_id;
    }
    case "message_attachment": {
      if (!ctx.conversationId) throw new UserFacingError("Missing conversation.");
      const { data } = await admin
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", ctx.conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) throw new UserFacingError("You are not part of this conversation.");
      return null;
    }
    case "ticket_attachment": {
      if (!ctx.ticketId) return null; // attachments added while creating a ticket
      const supabase = await createClient();
      const { data } = await supabase.from("support_tickets").select("id").eq("id", ctx.ticketId).maybeSingle();
      if (!data) throw new UserFacingError("Ticket not found.");
      return null;
    }
  }
}

function pathPrefix(user: SessionUser, purpose: UploadPurpose, ctx: UploadContext, courseId: string | null): string {
  switch (purpose) {
    case "course_content":
      return `courses/${courseId}/content`;
    case "live_resource":
      return `courses/${courseId}/live`;
    case "course_image":
      return `courses/${courseId}`;
    case "category_image":
      return "categories";
    case "marketing":
      return "marketing";
    case "avatar":
      return user.id;
    case "submission":
      return `${user.id}/${ctx.assignmentId}`;
    case "message_attachment":
      return `messages/${ctx.conversationId}/${user.id}`;
    case "ticket_attachment":
      return `tickets/${user.id}`;
    case "document":
      return "admin";
  }
}

export interface SignedUpload {
  mediaFileId: string;
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
  publicUrl: string | null;
}

export async function createSignedUpload(
  user: SessionUser,
  input: { purpose: UploadPurpose; fileName: string; mimeType: string; size: number; context: UploadContext },
): Promise<SignedUpload> {
  const { purpose, fileName, size, context } = input;
  const ext = fileExtension(fileName);
  const allowed = await allowedExtensions(purpose);
  if (!ext || !allowed.includes(ext)) {
    throw new UserFacingError(`That file type isn't allowed here. Allowed: ${allowed.map((e) => `.${e}`).join(", ")}.`);
  }
  const mime = input.mimeType.toLowerCase();
  if (!(EXT_MIME[ext] ?? []).includes(mime)) {
    throw new UserFacingError("The file's type doesn't match its extension.");
  }
  const limit = await maxBytes(purpose);
  if (size <= 0) throw new UserFacingError("The file is empty.");
  if (size > limit) throw new UserFacingError(`Files can be up to ${Math.round(limit / 1024 / 1024)} MB.`);

  const courseId = await authorizeUpload(user, purpose, context);
  const bucket = BUCKET[purpose];
  const path = `${pathPrefix(user, purpose, context, courseId)}/${randomUUID()}-${safeFileName(fileName)}`;

  const admin = createAdminClient();
  const { data: file, error } = await admin
    .from("media_files")
    .insert({
      bucket,
      storage_path: path,
      file_name: fileName.slice(0, 200),
      mime_type: mime,
      size_bytes: size,
      purpose,
      course_id: courseId,
      uploaded_by: user.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !file) throw new Error(`media_files insert failed: ${error?.message}`);

  const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (signError || !signed) throw new Error(`createSignedUploadUrl failed: ${signError?.message}`);

  return {
    mediaFileId: file.id,
    bucket,
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
    publicUrl: PUBLIC_BUCKETS.has(bucket) ? admin.storage.from(bucket).getPublicUrl(path).data.publicUrl : null,
  };
}

/**
 * Confirms an upload: the object exists, its size matches, and its first
 * bytes match the declared format. Rejected files are deleted.
 */
export async function finalizeUpload(user: SessionUser, mediaFileId: string) {
  const admin = createAdminClient();
  const { data: file } = await admin.from("media_files").select("*").eq("id", mediaFileId).maybeSingle();
  if (!file || file.uploaded_by !== user.id) throw new UserFacingError("Upload not found.");
  if (file.status === "ready") return file;

  const reject = async (message: string) => {
    await admin.storage.from(file.bucket).remove([file.storage_path]);
    await admin.from("media_files").update({ status: "rejected" }).eq("id", file.id);
    throw new UserFacingError(message);
  };

  const { data: signed } = await admin.storage.from(file.bucket).createSignedUrl(file.storage_path, 60);
  if (!signed?.signedUrl) return reject("The upload didn't finish. Try again.");
  const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-15" } });
  if (!res.ok && res.status !== 206) return reject("The upload didn't finish. Try again.");
  const head = new Uint8Array(await res.arrayBuffer());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
  if (total && Math.abs(total - Number(file.size_bytes)) > 0) {
    return reject("The uploaded file size doesn't match. Try again.");
  }
  if (!matchesMagic(fileExtension(file.file_name), head)) {
    return reject("This file's contents don't match its type.");
  }

  const { data: updated } = await admin
    .from("media_files")
    .update({ status: "ready" })
    .eq("id", file.id)
    .select("*")
    .single();
  return updated ?? file;
}

/**
 * Can this user download the file? Checks follow the file's purpose; lesson
 * files are checked through RLS on the rows that reference them (which
 * includes drip release and access expiry).
 */
export async function canDownloadMedia(user: SessionUser, mediaFileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("media_files")
    .select("id, purpose, course_id, uploaded_by, status, bucket, storage_path")
    .eq("id", mediaFileId)
    .maybeSingle();
  if (!file || file.status !== "ready") return false;
  if (file.uploaded_by === user.id) return true;
  if (user.roles.includes("admin")) {
    const role = await getCourseRole(user, file.course_id ?? "00000000-0000-0000-0000-000000000000");
    if (role.isAdmin) return true;
  }

  const supabase = await createClient();
  switch (file.purpose) {
    case "course_content": {
      if (file.course_id) {
        const role = await getCourseRole(user, file.course_id);
        if (role.isInstructor) return true;
      }
      const [blocks, resources] = await Promise.all([
        supabase.from("lesson_content_blocks").select("id").eq("media_file_id", file.id).limit(1),
        supabase.from("lesson_resources").select("id").eq("media_file_id", file.id).limit(1),
      ]);
      return Boolean(blocks.data?.length || resources.data?.length);
    }
    case "live_resource": {
      const { data } = await supabase.from("live_session_resources").select("id").eq("media_file_id", file.id).limit(1);
      return Boolean(data?.length);
    }
    case "submission": {
      if (!file.course_id) return false;
      const role = await getCourseRole(user, file.course_id);
      return role.isInstructor || role.isAdmin;
    }
    case "message_attachment": {
      const { data } = await supabase.from("message_attachments").select("id").eq("media_file_id", file.id).limit(1);
      return Boolean(data?.length);
    }
    case "ticket_attachment": {
      const { data } = await supabase.from("support_ticket_attachments").select("id").eq("media_file_id", file.id).limit(1);
      return Boolean(data?.length);
    }
    case "course_image":
    case "category_image":
    case "marketing":
    case "avatar":
      return true;
    default:
      return false;
  }
}

/** Short-lived signed URL for a private file the caller has already been authorised for. */
export async function signedDownloadUrl(mediaFileId: string, opts: { download?: boolean; expiresIn?: number } = {}) {
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("media_files")
    .select("bucket, storage_path, file_name")
    .eq("id", mediaFileId)
    .single();
  if (!file) return null;
  if (PUBLIC_BUCKETS.has(file.bucket)) return admin.storage.from(file.bucket).getPublicUrl(file.storage_path).data.publicUrl;
  const { data } = await admin.storage
    .from(file.bucket)
    .createSignedUrl(file.storage_path, opts.expiresIn ?? 300, opts.download ? { download: file.file_name } : undefined);
  return data?.signedUrl ?? null;
}

export async function deleteMediaFile(mediaFileId: string) {
  const admin = createAdminClient();
  const { data: file } = await admin.from("media_files").select("bucket, storage_path").eq("id", mediaFileId).maybeSingle();
  if (!file) return;
  await admin.storage.from(file.bucket).remove([file.storage_path]);
  await admin.from("media_files").update({ status: "deleted" }).eq("id", mediaFileId);
}
