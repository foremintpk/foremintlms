import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { BookOpen, Library } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseThumb, LearnerCourseCardView } from "@/components/learning/course-card";
import { LibraryOpenButton } from "@/components/learning/library-open-button";
import { requireUser } from "@/lib/auth/guards";
import { getAllAccessLibrary, getLearnerCourses, type LearnerCourseCard } from "@/lib/services/learner";

export const instant = false;

export const metadata: Metadata = { title: "My courses" };

export default function MyCoursesPage() {
  return (
    <>
      <PageHeader title="My courses" description="Everything you're enrolled in, with your progress and access dates." />
      <Suspense fallback={<GridSkeleton />}>
        <MyCourses />
      </Suspense>
    </>
  );
}

function Grid({ cards, empty }: { cards: LearnerCourseCard[]; empty: React.ReactNode }) {
  if (cards.length === 0) return <>{empty}</>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <LearnerCourseCardView key={c.enrollmentId} card={c} />
      ))}
    </div>
  );
}

async function MyCourses() {
  const user = await requireUser("/learn/courses");
  const { cards, allAccess } = await getLearnerCourses(user);
  const active = cards.filter((c) => c.bucket === "active");
  const completed = cards.filter((c) => c.bucket === "completed");
  const expired = cards.filter((c) => c.bucket === "expired");
  const library = allAccess.active ? await getAllAccessLibrary(cards.map((c) => c.courseId)) : [];

  if (cards.length === 0 && !allAccess.active) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        description="When you enroll in a course it appears here, with your progress saved across devices."
        action={
          <Button asChild>
            <Link href="/courses">Explore courses</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Tabs defaultValue={active.length || !allAccess.active ? "active" : "library"}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        <TabsTrigger value="expired">Expired ({expired.length})</TabsTrigger>
        {allAccess.active ? <TabsTrigger value="library">All-access library</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="active" className="pt-4">
        <Grid
          cards={active}
          empty={
            <EmptyState
              icon={BookOpen}
              title="No active courses"
              description={allAccess.active ? "Open a course from your all-access library to start." : "Browse the catalogue to find your next course."}
              action={
                <Button asChild variant="outline">
                  <Link href="/courses">Browse courses</Link>
                </Button>
              }
            />
          }
        />
      </TabsContent>
      <TabsContent value="completed" className="pt-4">
        <Grid cards={completed} empty={<p className="text-sm text-muted-foreground">Courses you finish will be listed here with their certificates.</p>} />
      </TabsContent>
      <TabsContent value="expired" className="pt-4">
        <Grid
          cards={expired}
          empty={<p className="text-sm text-muted-foreground">Courses whose access has ended appear here. Your progress is kept if you renew.</p>}
        />
      </TabsContent>
      {allAccess.active ? (
        <TabsContent value="library" className="space-y-4 pt-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Library className="size-4" /> Your membership includes every published course
            {allAccess.expiresAt ? (
              <>
                {" "}
                until <LocalTime value={allAccess.expiresAt} format="date" />
              </>
            ) : null}
            .
          </p>
          {library.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {library.map((c) => (
                <article key={c.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card">
                  <CourseThumb src={c.thumbnailUrl} alt="" />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-heading font-semibold">{c.title}</h3>
                    {c.shortDescription ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.shortDescription}</p> : null}
                    <p className="mt-auto text-xs text-muted-foreground">
                      {c.totalLessons} lessons{c.instructors.length ? ` · ${c.instructors.join(", ")}` : ""}
                    </p>
                    <LibraryOpenButton courseId={c.id} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You&apos;ve opened every course in the library.</p>
          )}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading courses">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-80 rounded-2xl" />
      ))}
    </div>
  );
}
