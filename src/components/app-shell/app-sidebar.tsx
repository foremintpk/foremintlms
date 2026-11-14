"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Spinner } from "@/components/ui/spinner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { AREA_HOME, AREA_LABEL, NAV, type NavItem, type ShellArea } from "./nav-config";
import type { ShellBadges } from "./types";

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The item's icon, swapped for a spinner while its page is loading. Must render inside <Link>. */
function NavItemIcon({ icon: Icon }: { icon: NavItem["icon"] }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner aria-hidden className="text-primary" /> : <Icon />;
}

function NavMenu({ area, badges, pathname }: { area: ShellArea; badges: ShellBadges; pathname: string | null }) {
  const { setOpenMobile, isMobile } = useSidebar();
  return (
    <>
      {NAV[area].map((group, gi) => (
        <SidebarGroup key={group.label ?? `group-${gi}`}>
          {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const count = item.badge ? badges[item.badge] ?? 0 : 0;
                const active = pathname ? isActive(pathname, item) : false;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <NavItemIcon icon={item.icon} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {count > 0 ? (
                      <SidebarMenuBadge className="rounded-full bg-primary/10 text-primary">
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> unread</span>
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function ActiveNavMenu(props: { area: ShellArea; badges: ShellBadges }) {
  const pathname = usePathname();
  return <NavMenu {...props} pathname={pathname} />;
}

export function AppSidebar({ area, badges }: { area: ShellArea; badges: ShellBadges }) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="pb-3">
        <Link
          href={AREA_HOME[area]}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none group-data-[collapsible=icon]:px-0"
        >
          <span className="group-data-[collapsible=icon]:hidden">
            <Logo markClassName="size-7" />
          </span>
          <span className="hidden group-data-[collapsible=icon]:inline-flex">
            <LogoMark className="size-7" />
          </span>
        </Link>
        <p className="px-2 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
          {AREA_LABEL[area]} workspace
        </p>
      </SidebarHeader>
      <SidebarContent>
        {/* usePathname suspends while the static shell renders; show the menu without an active item meanwhile. */}
        <Suspense fallback={<NavMenu area={area} badges={badges} pathname={null} />}>
          <ActiveNavMenu area={area} badges={badges} />
        </Suspense>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          Need help?{" "}
          <Link href={area === "admin" ? "/admin/support" : `/${area}/support`} className="font-medium text-primary hover:underline">
            Open support
          </Link>
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
