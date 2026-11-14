import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", href: "/admin/advisor" },
  { key: "intents", label: "Intents & courses", href: "/admin/advisor/intents" },
  { key: "synonyms", label: "Synonyms", href: "/admin/advisor/synonyms" },
  { key: "settings", label: "Behaviour", href: "/admin/advisor/settings" },
  { key: "conversations", label: "Conversations", href: "/admin/advisor/conversations" },
] as const;

export type AdvisorTab = (typeof TABS)[number]["key"];

/** Sub-navigation for Admin → Course advisor. */
export function AdvisorNav({ active }: { active: AdvisorTab }) {
  return (
    <nav aria-label="Course advisor sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
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
      <Link href="/admin/faqs" className="-mb-px ml-auto inline-flex items-center gap-1 border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground">
        FAQs <ExternalLink className="size-3.5" aria-hidden />
      </Link>
    </nav>
  );
}
