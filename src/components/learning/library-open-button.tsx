"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { openLibraryCourseAction } from "@/app/learn/courses/actions";

/** All-access members: enroll on first open, then go to the course. */
export function LibraryOpenButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { run, pending } = useAction(openLibraryCourseAction, { onSuccess: (d) => router.push(`/learn/courses/${d.slug}`) });
  return (
    <Button size="sm" className="w-full" disabled={pending} onClick={() => run({ courseId })}>
      {pending ? "Opening…" : "Start course"}
    </Button>
  );
}
