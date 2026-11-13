"use client";

import { RouteError } from "@/components/learning/route-error";

export default function QuizError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} title="This quiz couldn't load" />;
}
