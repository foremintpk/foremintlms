"use client";

import { RouteError } from "@/components/teaching/route-states";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} what="Settings" />;
}
