import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "templates", label: "Templates", href: "/admin/emails" },
  { key: "outbox", label: "Outbox", href: "/admin/emails/outbox" },
  { key: "sender", label: "Sender & delivery", href: "/admin/emails/sender" },
] as const;

export function EmailsNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Email sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export const CATEGORY_LABELS: Record<string, string> = {
  auth: "Account and security",
  billing: "Billing and access",
  learning: "Learning",
  communication: "Messages and support",
  system: "System",
};
