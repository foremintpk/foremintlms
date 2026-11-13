import { cn } from "@/lib/utils";

/** The Foremint mark: a violet tile with an "F" whose middle arm is a mint leaf. */
export function LogoMark({ className, title = "Foremint Academy" }: { className?: string; title?: string }) {
  const id = "fm-tile-gradient";
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6A4DFF" />
          <stop offset="1" stopColor="#4A2BDB" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <rect x="16" y="13" width="10" height="38" rx="5" fill="#FFFFFF" />
      <rect x="16" y="13" width="31" height="10" rx="5" fill="#FFFFFF" />
      <path d="M24.5 42.5C26 31.5 35 26.5 48 27.5C47 39 37.5 44.5 24.5 42.5Z" fill="#3DDC97" />
      <path d="M27.5 40.2C33 36.2 38.5 32.6 44.5 30.2" stroke="#2BB07A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Full logo: mark + wordmark. The wordmark is live text in the display face
 * so it stays crisp at every size and adapts to light/dark themes.
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
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} title="" />
      <span
        className={cn(
          "font-heading text-[1.35rem] leading-none font-bold tracking-[-0.04em]",
          tone === "inverse" ? "text-white" : "text-foreground",
        )}
      >
        foremint
        {showAcademy ? (
          <span
            className={cn(
              "ml-1 font-sans text-[0.95rem] font-medium tracking-[-0.01em]",
              tone === "inverse" ? "text-white/70" : "text-muted-foreground",
            )}
          >
            academy
          </span>
        ) : null}
      </span>
      <span className="sr-only">Foremint Academy</span>
    </span>
  );
}
