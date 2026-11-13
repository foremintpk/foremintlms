import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { LocalTime } from "@/components/common/local-time";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ReviewDecisionButtons } from "@/components/communication/moderation/controls";
import { PersonAvatar } from "@/components/communication/person";
import { PlainText } from "@/components/communication/plain-text";
import { requireAdmin } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";
import { listReviews, reviewCounts, type ReviewStatus } from "@/lib/services/moderation";

export const instant = false;
export const metadata = { title: "Course reviews" };

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Waiting for review" },
  { key: "published", label: "Published" },
  { key: "rejected", label: "Rejected" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-4", i < rating ? "fill-[#F5A524] text-[#F5A524]" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  );
}

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin("/admin/reviews");
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status: ReviewStatus = raw === "published" || raw === "rejected" ? raw : "pending";
  const lp = parseListParams(sp, { pageSize: 15 });
  const [{ items, total }, counts] = await Promise.all([listReviews({ status, q: lp.q, from: lp.from, to: lp.to }), reviewCounts()]);

  return (
    <>
      <PageHeader
        title="Course reviews"
        description="Reviews from enrolled students appear on course pages only after you publish them. Editing a published review sends it back for review."
      />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Review status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reviews${t.key === "pending" ? "" : `?status=${t.key}`}`}
            aria-current={status === t.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              status === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      <ListToolbar searchPlaceholder="Search review text" />
      {items.length === 0 ? (
        <EmptyState
          icon={Star}
          title={status === "pending" ? "No reviews waiting" : `No ${status} reviews`}
          description={status === "pending" ? "New reviews from students will wait here until you publish or reject them." : "Try a different search."}
        />
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-4 shadow-card sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <PersonAvatar person={r.author} className="size-8" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.author.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.course ? (
                      <Link href={`/courses/${r.course.slug}`} className="hover:underline">
                        {r.course.title}
                      </Link>
                    ) : (
                      "Deleted course"
                    )}{" "}
                    · <LocalTime value={r.updatedAt} format="relative" />
                  </p>
                </div>
                {r.verifiedEnrollment ? (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success-soft px-2 text-[11px] font-medium text-success">
                    <BadgeCheck className="size-3" /> Verified enrollment
                  </span>
                ) : (
                  <span className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-[11px] font-medium text-warning">Not enrolled</span>
                )}
                <span className="ml-auto">
                  <Stars rating={r.rating} />
                </span>
              </div>
              {r.title ? <p className="mt-3 font-medium">{r.title}</p> : null}
              {r.body ? <PlainText text={r.body} className="mt-1 text-sm" /> : <p className="mt-2 text-sm text-muted-foreground">Rating only — no written review.</p>}
              {r.moderationNote ? (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Moderator note: {r.moderationNote}</p>
              ) : null}
              <div className="mt-4">
                <ReviewDecisionButtons reviewId={r.id} status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <PaginationBar basePath="/admin/reviews" searchParams={sp} page={lp.page} pageSize={lp.pageSize} total={total} />
    </>
  );
}
