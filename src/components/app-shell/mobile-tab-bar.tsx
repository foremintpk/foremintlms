"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { BookOpen, LayoutDashboard, MessageSquare, Radio, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShellBadges } from "./types";

const TABS = [
  { href: "/learn", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/learn/courses", label: "Courses", icon: BookOpen },
  { href: "/learn/live", label: "Live", icon: Radio },
  { href: "/learn/messages", label: "Messages", icon: MessageSquare, badge: "unreadMessages" as const },
  { href: "/learn/settings", label: "Account", icon: User },
];

function Tabs({ badges, pathname }: { badges: ShellBadges; pathname: string | null }) {
  return (
    <ul className="grid grid-cols-5">
      {TABS.map((tab) => {
        const active = pathname
          ? tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          : false;
        const count = tab.badge ? badges[tab.badge] ?? 0 : 0;
        return (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              {tab.label}
              {count > 0 ? <span className="absolute top-1.5 left-1/2 ml-2 size-2 rounded-full bg-primary" aria-hidden /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveTabs({ badges }: { badges: ShellBadges }) {
  return <Tabs badges={badges} pathname={usePathname()} />;
}

/** Thumb-reachable primary navigation for students on phones. */
export function MobileTabBar({ badges }: { badges: ShellBadges }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <Suspense fallback={<Tabs badges={badges} pathname={null} />}>
        <ActiveTabs badges={badges} />
      </Suspense>
    </nav>
  );
}
