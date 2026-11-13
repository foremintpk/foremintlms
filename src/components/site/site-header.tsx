import Link from "next/link";
import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { getNavCategories } from "@/lib/services/public/catalog";
import { cn } from "@/lib/utils";
import { Container, ctaClass } from "./primitives";
import { DesktopNav, MobileNav } from "./site-nav";

function VisitorActions({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", stacked && "flex-col items-stretch")}>
      <Link
        href="/login"
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted",
          stacked && "border",
        )}
      >
        Log in
      </Link>
      <Link href="/courses" className={ctaClass("primary", cn("h-10 text-sm", !stacked && "max-sm:hidden"))}>
        Explore courses
      </Link>
    </div>
  );
}

/** Reads the session, so it always renders inside a Suspense boundary. */
async function HeaderAuth({ stacked = false }: { stacked?: boolean }) {
  const user = await getSessionUser();
  if (!user || user.accountStatus !== "active") return <VisitorActions stacked={stacked} />;
  return (
    <Link href={homePathFor(user)} className={ctaClass("primary", cn("h-10 text-sm", stacked && "w-full"))}>
      <LayoutDashboard className="size-4" aria-hidden />
      Go to dashboard
    </Link>
  );
}

export async function SiteHeader() {
  const categories = await getNavCategories();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center gap-4 lg:gap-8">
        <Link href="/" className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Foremint Academy home">
          <Logo markClassName="size-8" />
        </Link>
        <DesktopNav categories={categories} />
        <div className="ml-auto flex items-center gap-2">
          <div className="max-lg:hidden">
            <Suspense fallback={<VisitorActions />}>
              <HeaderAuth />
            </Suspense>
          </div>
          <Link href="/courses" className={ctaClass("primary", "h-10 text-sm lg:hidden max-sm:hidden")}>
            Explore courses
          </Link>
          <MobileNav
            categories={categories}
            authSlot={
              <Suspense fallback={<VisitorActions stacked />}>
                <HeaderAuth stacked />
              </Suspense>
            }
          />
        </div>
      </Container>
    </header>
  );
}
