"use client";

import { useState } from "react";
import { MessageCircleReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReplyComposer } from "./composers";

/** Inline answer box for the instructor question queue. */
export function QuickAnswer({ courseId, discussionId }: { courseId: string; discussionId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <MessageCircleReply className="size-4" /> Answer
      </Button>
    );
  }
  return (
    <div className="mt-3 w-full">
      <ReplyComposer courseId={courseId} discussionId={discussionId} autoFocus placeholder="Write your answer" submitLabel="Post answer" rows={4} />
      <Button variant="ghost" size="sm" className="mt-1" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
