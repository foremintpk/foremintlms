import { cn } from "@/lib/utils";

/**
 * The Foremint Academy mark: a mortarboard over two folded ribbons that form
 * an "F". Vector source: public/brand/foremint-mark.svg (raster sizes are
 * generated from it by scripts/generate-brand-assets.mjs). Served as a static
 * file so every instance shares one cached request and the SVG's internal
 * gradient/mask ids can never collide on a page.
 */
export function LogoMark({ className, title = "Foremint Academy" }: { className?: string; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static vector brand asset; nothing to optimise
    <img
      src="/brand/foremint-mark.svg"
      alt={title}
      width={32}
      height={32}
      draggable={false}
      decoding="async"
      className={cn("size-8 shrink-0 select-none", className)}
    />
  );
}

/**
 * Full logo: mark + wordmark, laid out like the brand artwork ("Foremint"
 * over a letter-spaced "Academy" between two rules). The wordmark is live
 * text in the display face so it stays crisp and follows light/dark themes.
 */
export function Logo({
  className,
  markClassName,
  showAcademy = true,
  tone = "default",
}: {
  className?: string;
  markClassName?: string;
  showAcademy?: boolean;
  tone?: "default" | "inverse";
}) {
  const inverse = tone === "inverse";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} title="" />
      <span aria-hidden className="flex flex-col leading-none">
        <span className={cn("font-heading text-[1.32rem] leading-none font-extrabold tracking-[-0.035em]", inverse ? "text-white" : "text-foreground")}>
          Foremint
        </span>
        {showAcademy ? (
          <span
            className={cn(
              "mt-[3px] flex items-center gap-1 text-[0.5rem] leading-none font-semibold uppercase",
              inverse ? "text-violet-300" : "text-primary",
            )}
          >
            <span className={cn("h-px w-2.5", inverse ? "bg-violet-300/60" : "bg-primary/50")} />
            <span className="mr-[-0.42em] tracking-[0.42em]">Academy</span>
            <span className={cn("h-px flex-1", inverse ? "bg-violet-300/60" : "bg-primary/50")} />
          </span>
        ) : null}
      </span>
      <span className="sr-only">Foremint Academy</span>
    </span>
  );
}
