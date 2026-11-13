"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60svh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">This page didn&apos;t load</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Something went wrong on our side. Try again, and if it keeps happening, contact support
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="h-11 rounded-xl px-5">
          Try again
        </Button>
        <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold hover:bg-muted">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
