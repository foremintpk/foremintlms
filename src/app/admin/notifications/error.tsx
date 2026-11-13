"use client";

import { useEffect } from "react";
import { SectionError } from "@/components/admin/section-error";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <SectionError reset={retry} />;
}
