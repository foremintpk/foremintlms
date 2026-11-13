"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { UserMenu } from "./user-menu";
import type { ShellArea } from "./nav-config";
import type { ShellBadges, ShellUser } from "./types";

export function AppShell({
  area,
  user,
  badges,
  children,
}: {
  area: ShellArea;
  user: ShellUser;
  badges: ShellBadges;
  children: React.ReactNode;
}) {
  const unread = badges.unreadNotifications ?? 0;
  const notificationsHref = area === "admin" ? "/admin/notifications" : `/${area}/notifications`;

  return (
    <SidebarProvider>
      <AppSidebar area={area} badges={badges} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4 md:rounded-t-xl">
          <SidebarTrigger className="-ml-1" aria-label="Toggle navigation" />
          <Separator orientation="vertical" className="mr-1 h-5 max-md:hidden" />
          <div className="flex-1" />
          {area !== "admin" ? (
            <Link
              href={notificationsHref}
              className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="size-[18px]" />
              {unread > 0 ? (
                <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
          <UserMenu user={user} area={area} />
        </header>
        <div className="flex flex-1 flex-col px-4 pt-6 pb-24 sm:px-6 md:pb-10 lg:px-8">{children}</div>
        {area === "learn" ? <MobileTabBar badges={badges} /> : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
