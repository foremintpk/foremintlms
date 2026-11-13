import type { LucideIcon } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/** An empty screen is an invitation to act: say what belongs here and how to add it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border border-dashed bg-card/60 py-12", className)}>
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia className="size-11 rounded-2xl bg-brand-soft text-primary [&_svg]:size-5">
            <Icon />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
