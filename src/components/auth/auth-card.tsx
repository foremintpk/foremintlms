import { cn } from "@/lib/utils";

/** Centered heading + content block used by every auth screen. */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[400px]", className)}>
      <div className="mb-7 space-y-2">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-[0.95rem] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {footer ? <div className="mt-8 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
