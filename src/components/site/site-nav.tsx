"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface NavCategory {
  slug: string;
  name: string;
  short_description: string | null;
}

const RESOURCES = [
  { href: "/blog", title: "Blog", description: "Guides and practical articles" },
  { href: "/case-studies", title: "Case studies", description: "How learners applied their skills" },
  { href: "/success-stories", title: "Success stories", description: "Learning journeys from our students" },
  { href: "/faq", title: "FAQ", description: "Answers about courses, billing and access" },
];

const PRIMARY = [
  { href: "/programs", label: "Programs" },
  { href: "/instructors", label: "Instructors" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

const linkStyle =
  "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

export function DesktopNav({ categories }: { categories: NavCategory[] }) {
  return (
    <NavigationMenu viewport={false} className="max-lg:hidden">
      <NavigationMenuList className="gap-0.5">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="px-3 text-foreground/80">Courses</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[560px] p-2">
              <ul className="grid grid-cols-2 gap-1">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <NavigationMenuLink asChild>
                      <Link href={`/categories/${c.slug}`} className="flex-col items-start gap-0.5 rounded-lg p-2.5">
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.short_description ? (
                          <span className="line-clamp-1 text-xs text-muted-foreground">{c.short_description}</span>
                        ) : null}
                      </Link>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-2 gap-1 border-t pt-2">
                <NavigationMenuLink asChild>
                  <Link href="/courses" className="justify-between rounded-lg p-2.5 text-sm font-semibold text-primary">
                    Browse all courses
                  </Link>
                </NavigationMenuLink>
                <NavigationMenuLink asChild>
                  <Link href="/courses/select" className="flex-col items-start gap-0.5 rounded-lg bg-brand-soft/60 p-2.5">
                    <span className="text-sm font-semibold text-primary">Build your learning plan</span>
                    <span className="text-xs text-muted-foreground">Choose the skills you want to master</span>
                  </Link>
                </NavigationMenuLink>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
        {PRIMARY.slice(0, 3).map((item) => (
          <NavigationMenuItem key={item.href}>
            <NavigationMenuLink asChild>
              <Link href={item.href} className={linkStyle}>
                {item.label}
              </Link>
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
        <NavigationMenuItem>
          <NavigationMenuTrigger className="px-3 text-foreground/80">Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[320px] gap-1 p-2">
              {RESOURCES.map((r) => (
                <li key={r.href}>
                  <NavigationMenuLink asChild>
                    <Link href={r.href} className="flex-col items-start gap-0.5 rounded-lg p-2.5">
                      <span className="text-sm font-medium">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <Link href="/about" className={linkStyle}>
              About
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function MobileNav({ categories, authSlot }: { categories: NavCategory[]; authSlot: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "flex w-full items-center justify-between rounded-xl px-3 py-3 text-base font-medium transition-colors hover:bg-muted";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex size-10 items-center justify-center rounded-xl border bg-card text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-left">
            <Logo markClassName="size-7" />
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-3">
          <button type="button" className={item} aria-expanded={coursesOpen} onClick={() => setCoursesOpen((v) => !v)}>
            Courses
            <ChevronDown className={cn("size-4 transition-transform", coursesOpen && "rotate-180")} aria-hidden />
          </button>
          {coursesOpen ? (
            <ul className="mb-2 ml-3 border-l pl-3">
              <li>
                <Link href="/courses" onClick={close} className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary">
                  Browse all courses
                </Link>
              </li>
              <li>
                <Link href="/courses/select" onClick={close} className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary">
                  Build your learning plan
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} onClick={close} className="block rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/courses/select" onClick={close} className={cn(item, "text-primary")}>
            Build your learning plan
          </Link>
          {PRIMARY.map((p) => (
            <Link key={p.href} href={p.href} onClick={close} className={item}>
              {p.label}
            </Link>
          ))}
          <p className="mt-4 px-3 text-xs font-medium text-muted-foreground">Resources</p>
          {RESOURCES.map((r) => (
            <Link key={r.href} href={r.href} onClick={close} className={cn(item, "py-2.5 text-[0.95rem]")}>
              {r.title}
            </Link>
          ))}
          <Link href="/contact" onClick={close} className={cn(item, "py-2.5 text-[0.95rem]")}>
            Contact
          </Link>
        </nav>
        <div className="border-t p-4" onClick={close}>
          {authSlot}
        </div>
      </SheetContent>
    </Sheet>
  );
}
