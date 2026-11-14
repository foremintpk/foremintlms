"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * The floating "island" navigation bar. It slides in on load and, once the
 * page scrolls, morphs into a narrower, fully rounded pill with a deeper
 * shadow. Its height never changes, so the page doesn't jump.
 */
export function HeaderIsland({ children }: { children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(
    subscribe,
    () => window.scrollY > 24,
    () => false,
  );
  return (
    <div
      data-scrolled={scrolled ? "true" : "false"}
      className={cn(
        "relative mx-auto flex h-14 w-full max-w-7xl animate-island-in items-center gap-3 rounded-2xl border px-3 backdrop-blur-xl sm:gap-4 sm:px-4 lg:gap-6",
        "transition-[max-width,border-radius,background-color,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        scrolled
          ? "max-w-6xl rounded-full border-primary/15 bg-background/80 shadow-[0_18px_50px_-18px_rgb(21_18_46/0.35),0_0_0_1px_rgb(255_255_255/0.6)_inset]"
          : "border-border/70 bg-background/65 shadow-[0_10px_40px_-24px_rgb(74_43_219/0.35)]",
      )}
    >
      {/* A soft brand sheen along the top edge. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-10 -top-px h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--brand)_55%,transparent),transparent)]" />
      {children}
    </div>
  );
}
