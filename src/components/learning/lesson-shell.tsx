"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProgressBar } from "./progress-bar";

/**
 * Lesson layout: outline on the left (desktop) or in a drawer (mobile),
 * content in the middle, learning tools on the right (wide screens) or below.
 */
export function LessonShell({
  courseTitle,
  courseHref,
  progress,
  outline,
  aside,
  children,
}: {
  courseTitle: string;
  courseHref: string;
  progress: number | null;
  outline: React.ReactNode;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8">
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Open course outline">
              <ListTree /> Outline
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle className="pr-8 text-base">{courseTitle}</SheetTitle>
              <SheetDescription className="sr-only">Lessons in this course</SheetDescription>
              {progress !== null ? <ProgressBar value={progress} showValue size="sm" label="Course progress" /> : null}
            </SheetHeader>
            {/* Close the drawer when a lesson link is followed. */}
            <div className="p-3" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
              {outline}
            </div>
          </SheetContent>
        </Sheet>
        <Link href={courseHref} className="min-w-0 truncate text-sm font-medium text-muted-foreground hover:text-foreground">
          {courseTitle}
        </Link>
      </div>

      <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)_20rem]">
        <aside className="hidden border-r lg:block">
          <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto p-4">
            <Link href={courseHref} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> Course overview
            </Link>
            <p className="font-heading text-[15px] leading-snug font-semibold">{courseTitle}</p>
            {progress !== null ? <ProgressBar value={progress} showValue size="sm" className="mt-2 mb-4" label="Course progress" /> : <div className="mb-4" />}
            {outline}
          </div>
        </aside>
        <div className="min-w-0 px-4 pt-6 pb-10 sm:px-6 lg:px-8">{children}</div>
        <aside className="border-t px-4 py-6 sm:px-6 xl:border-t-0 xl:border-l xl:px-4">
          <div className="xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto">{aside}</div>
        </aside>
      </div>
    </div>
  );
}
