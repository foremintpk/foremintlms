"use client";

import { RouteError } from "@/components/learning/route-error";

export default function AssignmentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} title="This assignment couldn't load" />;
}
