import { HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { FaqFormDialog, FaqGroup, type FaqRow } from "@/components/admin/faqs/faq-manager";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { humanizeStatus } from "@/components/common/status-badge";

export const instant = false;
export const metadata = { title: "FAQs" };

const ORDER = ["general", "courses", "billing", "certificates", "live", "technical", "instructors"];

export default async function FaqsPage() {
  await requireAdmin("/admin/faqs");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("id, question, answer, category, sort_order, is_published, show_on_home, keywords, advisor_enabled, advisor_priority")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const faqs = (data ?? []) as FaqRow[];
  const groups = ORDER.map((cat) => ({ cat, items: faqs.filter((f) => f.category === cat) })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Answers shown on the FAQ page. Mark a few as “show on home” for the home page FAQ section. Published FAQs also answer questions in the course advisor — add keywords to help it find the right one."
        actions={<FaqFormDialog trigger={<Button>New FAQ</Button>} />}
      />
      {faqs.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No FAQs yet" description="Add the questions learners ask most often." action={<FaqFormDialog trigger={<Button>New FAQ</Button>} />} />
      ) : (
        <div className="grid gap-8">
          {groups.map((g) => (
            <section key={g.cat}>
              <h2 className="mb-3 text-base font-semibold">{humanizeStatus(g.cat)}</h2>
              <FaqGroup items={g.items} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
