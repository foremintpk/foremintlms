import Link from "next/link";
import { Lock, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

const REASONS: Record<string, string> = {
  expired: "Your access to this course has ended, so its discussions are closed to you. Renew your access to rejoin the conversation.",
  revoked: "Your access to this course was removed. Contact support if you think this is a mistake.",
  suspended: "Your access to this course is paused while a billing issue is resolved.",
  course_unavailable: "This course isn't available right now.",
  none: "Course discussions are open to enrolled students. Enroll to ask questions and join the conversation.",
};

export function DiscussionAccessRequired({ courseSlug, courseTitle, reason }: { courseSlug: string; courseTitle: string; reason: string }) {
  return (
    <EmptyState
      icon={Lock}
      title={`Discussions for ${courseTitle} are for enrolled students`}
      description={REASONS[reason] ?? REASONS.none}
      action={
        <Button asChild>
          <Link href={reason === "none" || reason === "expired" ? `/courses/${courseSlug}` : `/learn/support/new`}>
            {reason === "none" ? "View course options" : reason === "expired" ? "Renew access" : "Contact support"}
          </Link>
        </Button>
      }
    />
  );
}

export function DiscussionsDisabled({ courseSlug }: { courseSlug: string }) {
  return (
    <EmptyState
      icon={MessagesSquare}
      title="Discussions are turned off for this course"
      description="The instructor has switched off course discussions. You can still message your instructor privately."
      action={
        <Button asChild variant="outline">
          <Link href={`/learn/courses/${courseSlug}`}>Back to the course</Link>
        </Button>
      }
    />
  );
}
