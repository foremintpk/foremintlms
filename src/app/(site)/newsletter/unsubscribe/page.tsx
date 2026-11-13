import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeForm } from "@/components/site/forms";
import { Container } from "@/components/site/primitives";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

async function UnsubscribeBody({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const token = typeof raw.token === "string" ? raw.token : "";
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return <p className="text-muted-foreground">This unsubscribe link is incomplete. Use the link from the bottom of one of our emails, or contact us and we&apos;ll remove you.</p>;
  }
  // A button (POST) rather than a GET link, so email scanners that prefetch
  // links can't unsubscribe people by accident.
  return <UnsubscribeForm token={token} />;
}

export default function UnsubscribePage({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <Container className="max-w-xl py-16 sm:py-24">
      <h1 className="text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] sm:text-[2.6rem]">Unsubscribe from the newsletter</h1>
      <p className="mt-3 mb-8 text-muted-foreground">You&apos;ll still receive emails about your account, purchases and courses.</p>
      <Suspense fallback={<div className="h-11" />}>
        <UnsubscribeBody searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
