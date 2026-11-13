import Link from "next/link";
import { BookOpen, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ListToolbar } from "@/components/common/list-toolbar";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { requireAdmin, requireTeacher } from "@/lib/auth/guards";
import { parseListParams } from "@/lib/list-params";
import { listCategoryOptions } from "@/lib/services/courses/builder";
import { countCoursesInReview, listAdminCourses, listInstructorFilterOptions, listTeacherCourses } from "@/lib/services/courses/lists";
import { cn } from "@/lib/utils";
import { AdminCourseTable } from "../admin-course-table";
import { NewCourseForm } from "../new-course-form";

type SearchParams = Record<string, string | string[] | undefined>;

export async function TeacherCourseListPage() {
  const user = await requireTeacher("/teach/courses");
  const courses = await listTeacherCourses(user.id);
  return (
    <>
      <PageHeader
        title="Your courses"
        description="Courses you teach. Edit content, add quizzes and assignments, and submit drafts for publication."
        actions={
          user.canCreateCourses ? (
            <Button asChild>
              <Link href="/teach/courses/new">
                <Plus /> New course
              </Link>
            </Button>
          ) : undefined
        }
      />
      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses assigned yet"
          description={
            user.canCreateCourses
              ? "Create your first course, or ask an administrator to assign you to an existing one."
              : "An administrator will assign you to courses. They'll appear here."
          }
          action={
            user.canCreateCourses ? (
              <Button asChild>
                <Link href="/teach/courses/new">
                  <Plus /> New course
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/teach/courses/${c.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-colors hover:border-primary/30"
              >
                <div className="relative aspect-video bg-muted">
                  {c.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded course thumbnails of arbitrary size
                    <img src={c.thumbnail_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <BookOpen className="size-6" aria-hidden />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <StatusBadge status={c.status} className="bg-card/95 shadow-card" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xs text-muted-foreground">{c.category_name ?? "No category"}</p>
                  <h2 className="font-heading text-base leading-snug font-semibold group-hover:text-primary">{c.title}</h2>
                  <p className="mt-auto flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {c.lesson_count} lesson{c.lesson_count === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" /> {c.enrollment_count}
                    </span>
                    <span>
                      Updated <LocalTime value={c.updated_at} format="relative" />
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export async function NewCoursePage({ area }: { area: "teach" | "admin" }) {
  const user = area === "admin" ? await requireAdmin("/admin/courses/new") : await requireTeacher("/teach/courses/new");
  const base = area === "admin" ? "/admin/courses" : "/teach/courses";
  const categories = await listCategoryOptions();
  return (
    <>
      <PageHeader title="New course" description="Start with a title. The course stays a private draft until it's approved." back={{ href: base, label: "All courses" }} />
      {area === "teach" && !user.canCreateCourses ? (
        <EmptyState
          icon={BookOpen}
          title="Course creation isn't enabled for your account"
          description="Ask an administrator to allow you to create courses, or to assign you to an existing course."
        />
      ) : (
        <NewCourseForm area={area} categories={categories} />
      )}
    </>
  );
}

export async function AdminCourseListPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin("/admin/courses");
  const tab = searchParams.tab === "review" ? "review" : "all";
  const params = parseListParams(searchParams, {
    pageSize: 20,
    sortable: ["title", "status", "updated_at"],
    defaultDir: tab === "review" ? "asc" : "desc",
    filterKeys: ["status", "category", "instructor"],
  });
  const [{ rows, total }, categories, instructors, reviewCount] = await Promise.all([
    listAdminCourses(params, tab),
    listCategoryOptions(),
    listInstructorFilterOptions(),
    countCoursesInReview(),
  ]);
  const tabLink = (t: "all" | "review") =>
    cn(
      "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium",
      tab === t ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <PageHeader
        title="Courses"
        description="Every course on the platform. Review submissions, publish, feature and archive."
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus /> New course
            </Link>
          </Button>
        }
      />
      <nav aria-label="Course views" className="mb-4 flex gap-1 border-b">
        <Link href="/admin/courses" className={tabLink("all")} aria-current={tab === "all" ? "page" : undefined}>
          All courses
        </Link>
        <Link href="/admin/courses?tab=review" className={tabLink("review")} aria-current={tab === "review" ? "page" : undefined}>
          Review queue
          {reviewCount ? <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning tabular-nums">{reviewCount}</span> : null}
        </Link>
      </nav>
      <ListToolbar
        searchPlaceholder="Search courses"
        filters={[
          ...(tab === "all"
            ? [
                {
                  key: "status",
                  label: "Statuses",
                  options: [
                    { value: "draft", label: "Draft" },
                    { value: "in_review", label: "In review" },
                    { value: "published", label: "Published" },
                    { value: "unpublished", label: "Unpublished" },
                    { value: "archived", label: "Archived" },
                  ],
                },
              ]
            : []),
          { key: "category", label: "Categories", options: categories.map((c) => ({ value: c.id, label: c.name })) },
          { key: "instructor", label: "Instructors", options: instructors },
        ]}
      />
      <AdminCourseTable rows={rows} reviewTab={tab === "review"} />
      <PaginationBar basePath="/admin/courses" searchParams={searchParams} page={params.page} pageSize={params.pageSize} total={total} />
    </>
  );
}
