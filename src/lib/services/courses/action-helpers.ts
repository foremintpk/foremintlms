import "server-only";
import { refresh, updateTag } from "next/cache";
import { UserFacingError } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cache tags the public catalogue tags its course data with. */
export const COURSE_CACHE_TAGS = ["courses", "catalog"] as const;

interface PgError {
  code?: string;
  message: string;
}

/**
 * Convert a PostgREST error into something safe to show. Our triggers and
 * RPCs raise plain-language messages with SQLSTATE 42501/22023, which are
 * meant for the user; everything else stays server-side.
 */
export function throwDbError(error: PgError | null | undefined, context: string): void {
  if (!error) return;
  if (error.code === "42501" || error.code === "22023" || error.code === "P0001") {
    throw new UserFacingError(error.message.replace(/^.*?:\s*/, "") || "You can't make this change.");
  }
  if (error.code === "23505") throw new UserFacingError("That already exists. Use a different value.");
  if (error.code === "23503") throw new UserFacingError("This item is linked to something that no longer exists.");
  throw new Error(`${context}: ${error.message}`);
}

/** Unwrap a `{ data, error }` result, mapping DB errors; throws if data is missing. */
export function must<T>(result: { data: T | null; error: PgError | null }, context: string): T {
  throwDbError(result.error, context);
  if (result.data === null || result.data === undefined) throw new Error(`${context}: no data returned`);
  return result.data;
}

/** Invalidate public course caches and refresh the builder after a change. */
export function revalidateCourse(courseId: string, slug?: string | null) {
  for (const tag of COURSE_CACHE_TAGS) updateTag(tag);
  updateTag(`course:${courseId}`);
  if (slug) updateTag(`course:${slug}`);
  refresh();
}

/** Lesson/content edits don't change the public catalogue; just refresh. */
export function refreshBuilder(courseId: string) {
  updateTag(`course:${courseId}`);
  refresh();
}

export async function courseInstructorIds(courseId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("course_instructors").select("user_id").eq("course_id", courseId);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

export async function adminUserIds(): Promise<string[]> {
  const { data } = await createAdminClient().from("user_roles").select("user_id").eq("role", "admin");
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}
