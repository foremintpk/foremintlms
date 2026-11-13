import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ctaClass } from "@/components/site/primitives";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16 text-center">
      <Link href="/" aria-label="Foremint Academy home">
        <Logo />
      </Link>
      <p className="mt-12 font-heading text-7xl font-bold tracking-[-0.05em] text-primary/20 sm:text-8xl" aria-hidden>
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted-foreground">The link may be out of date, or the page may have moved. Try the course catalog or head back home.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/courses" className={ctaClass("primary")}>
          Browse courses
        </Link>
        <Link href="/" className={ctaClass("secondary")}>
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
