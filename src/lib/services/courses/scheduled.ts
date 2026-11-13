import "server-only";
import { revalidateTag } from "next/cache";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/services/notifications";

/**
 * Cron: publish content whose scheduled time has arrived.
 *  - Courses an admin approved with a schedule wait in "in_review" with
 *    reviewed_by + scheduled_publish_at set. Non-admin status changes clear
 *    both (see guard_course_schedule), so only approved versions publish.
 *  - Blog posts in "scheduled" status publish at published_at.
 * Idempotent: rows are claimed by the conditional UPDATE itself.
 */
export async function publishScheduledContent(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: courses, error: courseError } = await admin
    .from("courses")
    .update({ status: "published", published_at: now, scheduled_publish_at: null })
    .eq("status", "in_review")
    .not("reviewed_by", "is", null)
    .not("scheduled_publish_at", "is", null)
    .lte("scheduled_publish_at", now)
    .select("id, title, slug");
  if (courseError) throw new Error(`scheduled course publishing failed: ${courseError.message}`);

  const published = (courses ?? []) as { id: string; title: string; slug: string }[];
  for (const course of published) {
    await admin.from("audit_logs").insert({
      actor_id: null,
      actor_role: "system",
      action: "course.published",
      entity_type: "course",
      entity_id: course.id,
      summary: course.title,
      metadata: { scheduled: true },
    });
    const { data: instructors } = await admin.from("course_instructors").select("user_id").eq("course_id", course.id);
    const ids = ((instructors ?? []) as { user_id: string }[]).map((i) => i.user_id);
    if (ids.length) {
      await notify(ids, {
        category: "learning",
        type: "course_published",
        title: `${course.title} is now live`,
        url: `/teach/courses/${course.id}`,
        email: {
          templateKey: "learning.course_review_result",
          idempotencyKey: `course-scheduled-published:${course.id}`,
          payload: {
            course_title: course.title,
            review_result: "published on schedule",
            review_notes: "",
            cta_url: appUrl(`/courses/${course.slug}`),
          },
        },
      });
    }
    revalidateTag(`course:${course.id}`, "max");
    revalidateTag(`course:${course.slug}`, "max");
  }
  if (published.length) {
    revalidateTag("courses", "max");
    revalidateTag("catalog", "max");
  }

  const { data: posts, error: postError } = await admin
    .from("blog_posts")
    .update({ status: "published" })
    .eq("status", "scheduled")
    .not("published_at", "is", null)
    .lte("published_at", now)
    .select("id, slug");
  if (postError) throw new Error(`scheduled blog publishing failed: ${postError.message}`);
  const publishedPosts = (posts ?? []) as { id: string; slug: string }[];
  if (publishedPosts.length) {
    revalidateTag("blog", "max");
    for (const post of publishedPosts) revalidateTag(`blog:${post.slug}`, "max");
  }

  return published.length + publishedPosts.length;
}
