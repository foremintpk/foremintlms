"use client";

import { SectionError } from "@/components/communication/section-error";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError title="Support couldn't load" reset={reset} />;
}
