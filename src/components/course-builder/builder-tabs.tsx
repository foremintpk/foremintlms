"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BuilderTab {
  href: string;
  label: string;
  exact?: boolean;
  external?: boolean;
}

function TabLinks({ tabs, pathname }: { tabs: BuilderTab[]; pathname: string | null }) {
  return (
    <nav aria-label="Course sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-1 border-b">
        {tabs.map((tab) => {
          const active =
            !tab.external &&
            pathname !== null &&
            (tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.external ? <ExternalLink className="size-3" aria-hidden /> : null}
                {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveTabs({ tabs }: { tabs: BuilderTab[] }) {
  return <TabLinks tabs={tabs} pathname={usePathname()} />;
}

export function BuilderTabs({ tabs }: { tabs: BuilderTab[] }) {
  return (
    <Suspense fallback={<TabLinks tabs={tabs} pathname={null} />}>
      <ActiveTabs tabs={tabs} />
    </Suspense>
  );
}
