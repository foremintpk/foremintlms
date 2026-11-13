"use client";

import { RouteError } from "@/components/learning/route-error";

export default function LessonError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} title="This lesson couldn't load" />;
}
