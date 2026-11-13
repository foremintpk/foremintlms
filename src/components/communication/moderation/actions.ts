"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ok, runAction, type ActionResult } from "@/lib/actions";
import { moderateReview, resolveReport } from "@/lib/services/moderation";
import { PUBLIC_TAGS } from "@/lib/services/public/tags";

export async function resolveReportAction(input: {
  reportId: string;
  decision: "dismiss" | "hide" | "remove";
  note?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({ reportId: z.uuid(), decision: z.enum(["dismiss", "hide", "remove"]), note: z.string().trim().max(1000).optional() })
      .parse(input);
    await resolveReport(user, data.reportId, data.decision, data.note);
    updateTag(PUBLIC_TAGS.reviews);
    refresh();
    return ok(null, data.decision === "dismiss" ? "Report dismissed" : data.decision === "hide" ? "Content hidden" : "Content removed");
  });
}

export async function moderateReviewAction(input: {
  reviewId: string;
  decision: "publish" | "reject";
  note?: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertAdmin();
    const data = z
      .object({ reviewId: z.uuid(), decision: z.enum(["publish", "reject"]), note: z.string().trim().max(1000).optional() })
      .parse(input);
    const { courseId } = await moderateReview(user, data.reviewId, data.decision, data.note);
    // Public course pages show published reviews and ratings.
    updateTag(PUBLIC_TAGS.reviews);
    updateTag(`reviews:${courseId}`);
    updateTag(PUBLIC_TAGS.courses);
    refresh();
    return ok(null, data.decision === "publish" ? "Review published" : "Review rejected");
  });
}
