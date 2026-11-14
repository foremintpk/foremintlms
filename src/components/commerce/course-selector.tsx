"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, Check, ChevronUp, Clock, Loader2, PlayCircle, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaImage } from "@/components/site/primitives";
import { formatMinor } from "@/lib/domain/invoicing";
import { durationAccessLabel } from "@/lib/domain/commerce";
import type { SelectorCatalog, SelectorCourse } from "@/lib/domain/commerce-view";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { CartSummary } from "./cart-summary";

type Sort = "recommended" | "price_asc" | "price_desc" | "title";

const LEVELS: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", all_levels: "All levels" };

export function CourseSelector({ catalog }: { catalog: SelectorCatalog }) {
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The chosen period applies instantly (prices come from the catalogue); the cart syncs in the background.
  const [pickedDuration, setPickedDuration] = useState<string | null>(null);
  const latestPick = useRef<string | null>(null);
  const duration = pickedDuration ?? cart.cart?.duration ?? catalog.defaultDuration;
  const pickDuration = (key: string) => {
    if (key === duration) return;
    setPickedDuration(key);
    latestPick.current = key;
    // When the reply to the latest pick arrives, the server's period takes over (the same one on success).
    void cart.setDuration(key).finally(() => {
      if (latestPick.current === key) setPickedDuration(null);
    });
  };
  const selectedCount = cart.cart?.courseIds.length ?? 0;
  const limitReached = catalog.maxCourses !== null && selectedCount >= catalog.maxCourses;

  const courses = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog.courses.filter((c) => {
      if (category !== "all" && c.category?.slug !== category) return false;
      if (!q) return true;
      return [c.title, c.shortDescription ?? "", c.category?.name ?? "", ...c.instructors].some((t) => t.toLowerCase().includes(q));
    });
    // Courses without a price for this period always sort last.
    const price = (c: SelectorCourse) => (duration ? c.prices[duration]?.priceMinor : undefined);
    if (sort === "price_asc") list = [...list].sort((a, b) => (price(a) ?? Number.MAX_SAFE_INTEGER) - (price(b) ?? Number.MAX_SAFE_INTEGER));
    if (sort === "price_desc") list = [...list].sort((a, b) => (price(b) ?? -1) - (price(a) ?? -1));
    if (sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [catalog.courses, category, query, sort, duration]);

  // Keep floating buttons (the course advisor) clear of the mobile package bar.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--fm-floating-offset", selectedCount > 0 ? "84px" : "0px");
    return () => {
      root.style.removeProperty("--fm-floating-offset");
    };
  }, [selectedCount]);

  return (
    <section id="courses" aria-labelledby="selector-courses-title" className="scroll-mt-20 pb-28 lg:pb-20">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:px-8">
        <div className="min-w-0">
          <h2 id="selector-courses-title" className="sr-only">
            Available courses
          </h2>

          <div className="rounded-3xl border bg-card p-4 shadow-card sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Search courses</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses, topics or instructors"
                  className="h-11 rounded-xl pl-10 text-base sm:text-sm"
                  data-testid="selector-search"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Clear search">
                    <X className="size-4" />
                  </button>
                ) : null}
              </label>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="h-11 w-full rounded-xl sm:w-[200px]" aria-label="Sort courses">
                  <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price_asc">Price: low to high</SelectItem>
                  <SelectItem value="price_desc">Price: high to low</SelectItem>
                  <SelectItem value="title">Title A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {catalog.categories.length > 1 ? (
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filter by category">
                {[{ slug: "all", name: "All courses" }, ...catalog.categories].map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={category === c.slug}
                    onClick={() => setCategory(c.slug)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                      category === c.slug ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground/80 hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}

            {catalog.durations.length ? (
              <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Access period</p>
                  <p className="text-xs text-muted-foreground">Applies to every course in your package.</p>
                </div>
                <div className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Access period" data-testid="duration-picker">
                  {catalog.durations.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      role="radio"
                      aria-checked={duration === d.key}
                      onClick={() => pickDuration(d.key)}
                      className={cn(
                        "h-9 rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                        duration === d.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                      )}
                      data-testid={`duration-${d.key}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
            <p>
              {courses.length} {courses.length === 1 ? "course" : "courses"}
              {category !== "all" || query ? " match" : " available"}
            </p>
            {catalog.maxCourses ? <p>Up to {catalog.maxCourses} per order</p> : null}
          </div>

          {courses.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed bg-card p-10 text-center">
              <p className="font-medium">No courses match your search</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another word, or show all courses.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Show all courses
              </button>
            </div>
          ) : (
            <ul className="mt-4 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3" data-testid="selector-grid">
              {courses.map((course, i) => (
                <li key={course.id}>
                  <SelectorCourseCard course={course} duration={duration} currency={catalog.currency} priority={i < 2} limitReached={limitReached} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="max-lg:hidden" aria-label="Your learning package">
          <div className="sticky top-24">
            <CartSummary />
          </div>
        </aside>
      </div>

      {/* Mobile: a compact bar that expands into the full summary. */}
      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden", selectedCount === 0 && "hidden")}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left text-primary-foreground shadow-raised"
          aria-label={`Review your learning package: ${selectedCount} courses`}
          data-testid="mobile-cart-bar"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white/15 text-sm font-semibold tabular-nums">{selectedCount}</span>
          <span className="flex-1">
            <span className="block text-xs opacity-80">Your learning package</span>
            <span className="block font-semibold tabular-nums">{cart.cart ? formatMinor(cart.cart.totalMinor, cart.cart.currency) : "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            Review <ChevronUp className="size-4" aria-hidden />
          </span>
        </button>
      </div>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[88svh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Your learning package</DrawerTitle>
            <DrawerDescription>Selected courses, access period and total.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CartSummary className="border-0 p-1 shadow-none" onNavigate={() => setDrawerOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}

function SelectorCourseCard({
  course,
  duration,
  currency,
  priority,
  limitReached,
}: {
  course: SelectorCourse;
  duration: string | null;
  currency: string;
  priority: boolean;
  limitReached: boolean;
}) {
  const cart = useCart();
  const selected = cart.has(course.id);
  const pending = cart.pendingIds.has(course.id);
  const price = duration ? course.prices[duration] : undefined;
  const offered = Boolean(price);
  const disabled = pending || (!selected && (!offered || limitReached));

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow,transform] duration-200",
        selected ? "border-primary shadow-raised ring-1 ring-primary" : "hover:border-primary/30 hover:shadow-card",
      )}
      data-testid="selector-card"
      data-course-id={course.id}
      data-selected={selected ? "true" : "false"}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <MediaImage src={course.thumbnailUrl} alt="" priority={priority} sizes="(min-width: 1536px) 320px, (min-width: 640px) 40vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {course.isFeatured ? <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold backdrop-blur">Featured</span> : <span />}
          {selected ? (
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-raised" aria-hidden>
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : null}
        </div>
        {price?.promoLabel ? (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{price.promoLabel}</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {course.category ? <p className="text-sm font-medium text-primary">{course.category.name}</p> : null}
        <h3 className="mt-1 text-lg leading-snug font-semibold tracking-[-0.015em]">{course.title}</h3>
        {course.instructors.length ? <p className="mt-1 text-sm text-muted-foreground">with {course.instructors.join(", ")}</p> : null}
        {course.shortDescription ? <p className="mt-2.5 line-clamp-2 text-[0.95rem] text-muted-foreground">{course.shortDescription}</p> : null}

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <BarChart2 className="size-4" aria-hidden />
            {LEVELS[course.level] ?? "All levels"}
          </li>
          {course.lessonCount > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-4" aria-hidden />
              {course.lessonCount} lessons
            </li>
          ) : null}
          {course.durationMinutes ? (
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {formatDuration(course.durationMinutes)}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between gap-3 border-t pt-4">
            <div className="min-w-0">
              {price ? (
                <>
                  <p className="flex items-baseline gap-2">
                    <span className="font-heading text-xl font-semibold tracking-tight tabular-nums" data-testid="selector-price">
                      {formatMinor(price.priceMinor, currency)}
                    </span>
                    {price.compareAtMinor ? <span className="text-sm text-muted-foreground line-through tabular-nums">{formatMinor(price.compareAtMinor, currency)}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{durationAccessLabel(duration!)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not offered for this access period</p>
              )}
            </div>
            <Link href={`/courses/${course.slug}`} className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Details<span className="sr-only"> about {course.title}</span>
            </Link>
          </div>
          <button
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => void (selected ? cart.remove(course.id, { silent: true }) : cart.add([course.id], { silent: true }))}
            className={cn(
              "mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "border-primary bg-primary text-primary-foreground hover:bg-brand-strong" : "border-primary/30 bg-brand-soft/60 text-primary hover:border-primary hover:bg-brand-soft",
            )}
            data-testid="selector-toggle"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : selected ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {selected ? "Added to package" : !offered ? "Choose another period" : limitReached ? "Package limit reached" : "Add to package"}
            <span className="sr-only"> — {course.title}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
