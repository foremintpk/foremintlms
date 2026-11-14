import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { serializeJsonLd } from "@/lib/services/public/shape";
import { cn } from "@/lib/utils";

/** Page-width container used by every marketing section. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Marketing-size call-to-action buttons (the app's buttons are compact). */
export function ctaClass(variant: "primary" | "secondary" | "ghost" | "inverse" = "primary", className?: string) {
  return cn(
    buttonVariants({ variant: variant === "secondary" ? "outline" : variant === "ghost" ? "ghost" : "default" }),
    "h-11 gap-2 rounded-full px-5 text-[0.95rem] font-semibold",
    variant === "primary" && "shadow-raised hover:bg-brand-strong",
    variant === "secondary" && "bg-card",
    variant === "inverse" && "bg-white text-ink hover:bg-white/90",
    className,
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  title: string;
  subtitle?: string | null;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-4 sm:mb-12",
        align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        <Tag className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] text-foreground sm:text-[2.4rem]">{title}</Tag>
        {subtitle ? <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Hero block for interior pages. */
export function PageIntro({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("-mt-[4.25rem] border-b bg-[linear-gradient(180deg,var(--brand-soft),transparent)] pt-[calc(4.25rem+3.5rem)] pb-12 sm:pt-[calc(4.25rem+5rem)] sm:pb-16", className)}>
      <Container>
        <h1 className="max-w-3xl text-[2.4rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-[3.4rem]">{title}</h1>
        {description ? <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p> : null}
        {children}
      </Container>
    </section>
  );
}

const OPTIMIZABLE_HOSTS = (() => {
  const hosts = ["image.mux.com", "i.ytimg.com"];
  try {
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    if (supabase) hosts.push(supabase);
  } catch {
    /* no supabase url configured */
  }
  return hosts;
})();

function canOptimize(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return OPTIMIZABLE_HOSTS.includes(host) || host.endsWith(".b-cdn.net");
  } catch {
    return false;
  }
}

/**
 * Image that uses next/image for known hosts and falls back to a plain
 * <img> for anything else an administrator may have pasted.
 */
export function MediaImage({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return <div aria-hidden className={cn("absolute inset-0 bg-[linear-gradient(135deg,var(--brand-soft),var(--mint-soft))]", className)} />;
  }
  if (canOptimize(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} className={cn("absolute inset-0 size-full object-cover", className)} />;
}

export function RatingStars({ value, count, className }: { value: number; count?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn("size-3.5", i <= rounded ? "fill-[#F5A524] text-[#F5A524]" : i - 0.5 === rounded ? "fill-[#F5A524]/50 text-[#F5A524]" : "text-muted-foreground/40")}
          />
        ))}
      </span>
      <span className="font-semibold tabular-nums">{value.toFixed(1)}</span>
      {count !== undefined ? (
        <span className="text-muted-foreground">
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      ) : null}
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5{count !== undefined ? ` from ${count} reviews` : ""}
      </span>
    </span>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden className="text-muted-foreground/50">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Simple previous/next pagination for public lists. */
export function SimplePagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = "inline-flex h-10 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted";
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link} rel="prev">
          Previous page
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={link} rel="next">
          Next page
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
