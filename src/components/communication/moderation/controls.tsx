"use client";

import { useTransition } from "react";
import { Check, EyeOff, Eye, ShieldX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/common/confirm-action";
import { staffDiscussionActionAction } from "../discussions/actions";
import { moderateReviewAction, resolveReportAction } from "./actions";

export function ReportDecisionButtons({ reportId, targetExists, targetType }: { reportId: string; targetExists: boolean; targetType: string }) {
  const what = targetType === "reply" ? "reply" : targetType === "message" ? "message" : targetType === "review" ? "review" : "discussion";
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmAction
        trigger={
          <Button size="sm" variant="outline">
            <X className="size-4" /> Dismiss
          </Button>
        }
        title="Dismiss this report?"
        description="The content stays as it is. Other open reports about the same content are closed too."
        confirmLabel="Dismiss report"
        action={({ reason }) => resolveReportAction({ reportId, decision: "dismiss", note: reason })}
      />
      {targetExists && (targetType === "discussion" || targetType === "reply") ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="secondary">
              <EyeOff className="size-4" /> Hide {what}
            </Button>
          }
          title={`Hide this ${what}?`}
          description="Students won't see it; course staff still can, and it can be made visible again."
          confirmLabel={`Hide ${what}`}
          requireReason
          reasonLabel="Reason (recorded in the audit log)"
          action={({ reason }) => resolveReportAction({ reportId, decision: "hide", note: reason })}
        />
      ) : null}
      {targetExists ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="destructive">
              <ShieldX className="size-4" /> {targetType === "review" ? "Reject review" : `Remove ${what}`}
            </Button>
          }
          title={targetType === "review" ? "Reject this review?" : `Remove this ${what}?`}
          description={
            targetType === "message"
              ? "The message text is replaced with “Removed by a moderator”. The original is kept in the audit log."
              : "The content is removed for everyone."
          }
          confirmLabel={targetType === "review" ? "Reject review" : `Remove ${what}`}
          destructive
          requireReason
          reasonLabel="Reason (recorded in the audit log)"
          action={({ reason }) => resolveReportAction({ reportId, decision: "remove", note: reason })}
        />
      ) : null}
    </div>
  );
}

export function ReviewDecisionButtons({ reviewId, status }: { reviewId: string; status: "pending" | "published" | "rejected" }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await moderateReviewAction({ reviewId, decision: "publish" });
              if (res.ok) toast.success(res.message ?? "Published");
              else toast.error(res.error);
            })
          }
        >
          <Check className="size-4" /> Publish
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="outline">
              <X className="size-4" /> {status === "published" ? "Unpublish" : "Reject"}
            </Button>
          }
          title={status === "published" ? "Unpublish this review?" : "Reject this review?"}
          description="The note is sent to the reviewer so they know why it isn't shown."
          confirmLabel={status === "published" ? "Unpublish review" : "Reject review"}
          requireReason
          reasonLabel="Note to the reviewer"
          action={({ reason }) => moderateReviewAction({ reviewId, decision: "reject", note: reason })}
        />
      ) : null}
    </div>
  );
}

export function DiscussionModerationButtons({ discussionId, status }: { discussionId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const run = (action: "hide" | "unhide" | "remove") =>
    startTransition(async () => {
      if (action === "remove" && !window.confirm("Remove this discussion for everyone?")) return;
      const res = await staffDiscussionActionAction({ discussionId, action });
      if (res.ok) toast.success(res.message ?? "Updated");
      else toast.error(res.error);
    });
  if (status === "removed") return <span className="text-xs text-muted-foreground">Removed</span>;
  return (
    <div className="flex gap-1">
      <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => run(status === "hidden" ? "unhide" : "hide")} aria-label={status === "hidden" ? "Make visible" : "Hide from students"} title={status === "hidden" ? "Make visible" : "Hide from students"}>
        {status === "hidden" ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </Button>
      <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => run("remove")} aria-label="Remove discussion" title="Remove discussion" className="text-destructive hover:text-destructive">
        <ShieldX className="size-4" />
      </Button>
    </div>
  );
}
