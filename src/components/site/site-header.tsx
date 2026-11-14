import Link from "next/link";
import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { getNavCategories } from "@/lib/services/public/catalog";
import { cn } from "@/lib/utils";
import { ctaClass } from "./primitives";
import { HeaderIsland } from "./header-island";
import { DesktopNav, MobileNav } from "./site-nav";
import { HeaderCartButton } from "@/components/commerce/header-cart-button";

function VisitorActions({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", stacked && "flex-col items-stretch")}>
      <Link
        href="/login"
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted",
          stacked && "border",
        )}
      >
        Log in
      </Link>
      <Link href="/courses/select" className={ctaClass("primary", cn("h-10 text-sm", !stacked && "max-sm:hidden"))}>
        Build your learning plan
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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <HeaderIsland>
        <Link href="/" className="group/logo shrink-0 rounded-lg pl-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Foremint Academy home">
          <Logo markClassName="size-8 transition-transform duration-300 group-hover/logo:rotate-[-8deg]" />
        </Link>
        <DesktopNav categories={categories} />
        <div className="ml-auto flex items-center gap-2">
          <HeaderCartButton />
          <div className="max-lg:hidden">
            <Suspense fallback={<VisitorActions />}>
              <HeaderAuth />
            </Suspense>
          </div>
          <Link href="/courses/select" className={ctaClass("primary", "h-10 text-sm lg:hidden max-sm:hidden")}>
            Build your plan
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
      </HeaderIsland>
    </header>
  );
}
