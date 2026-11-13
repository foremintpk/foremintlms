"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { GraduationCap, LogOut, Monitor, Moon, Presentation, Settings, ShieldCheck, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";
import { initials } from "@/lib/format";
import type { ShellArea } from "./nav-config";
import type { ShellUser } from "./types";

export function UserMenu({ user, area }: { user: ShellUser; area: ShellArea }) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const settingsHref = area === "admin" ? "/admin/settings" : `/${area}/settings`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Open account menu"
      >
        <Avatar className="size-8 ring-1 ring-border">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">
            {initials(user.fullName || user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{user.fullName || user.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {user.roles.includes("admin") && area !== "admin" ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck /> Admin workspace
              </Link>
            </DropdownMenuItem>
          ) : null}
          {user.roles.includes("teacher") && area !== "teach" ? (
            <DropdownMenuItem asChild>
              <Link href="/teach">
                <Presentation /> Instructor workspace
              </Link>
            </DropdownMenuItem>
          ) : null}
          {area !== "learn" ? (
            <DropdownMenuItem asChild>
              <Link href="/learn">
                <GraduationCap /> Student workspace
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={settingsHref}>
              <Settings /> Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" /> Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="light">
                  <Sun /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => signOut());
          }}
        >
          <LogOut /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
