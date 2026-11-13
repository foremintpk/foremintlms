import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewsletterForm } from "@/components/site/forms";
import { Container, MediaImage, PageIntro, SimplePagination } from "@/components/site/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { BLOG_PAGE_SIZE, getBlogCategories, getBlogPosts } from "@/lib/services/public/content";
import type { BlogPostSummary } from "@/lib/services/public/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog and resources",
  description: "Practical guides on e-commerce, selling online, SEO, development and digital marketing.",
  alternates: { canonical: appUrl("/blog") },
};

function PostCard({ post, large = false }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <article className={cn("group relative flex flex-col", large && "md:col-span-2 md:grid md:grid-cols-2 md:items-center md:gap-8")}>
      <div className={cn("relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted")}>
        <MediaImage src={post.cover_image_url} alt="" sizes={large ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"} className="transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <div className={cn("pt-4", large && "md:pt-0")}>
        <p className="text-sm text-muted-foreground">
          {post.category ? <span className="font-medium text-primary">{post.category}</span> : null}
          {post.category && post.published_at ? ", " : null}
          {post.published_at ? formatDate(post.published_at) : null}
          {post.reading_minutes ? `, ${post.reading_minutes} min read` : null}
        </p>
        <h2 className={cn("mt-2 font-semibold tracking-tight", large ? "text-2xl sm:text-3xl" : "text-lg")}>
          <Link href={`/blog/${post.slug}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">
            {post.title}
          </Link>
        </h2>
        {post.excerpt ? <p className={cn("mt-2 text-muted-foreground", !large && "line-clamp-3")}>{post.excerpt}</p> : null}
      </div>
    </article>
  );
}

async function PostList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const category = typeof raw.category === "string" ? raw.category.slice(0, 80) : null;
  const page = Math.max(1, Math.min(500, Number(typeof raw.page === "string" ? raw.page : 1) || 1));
  const [{ posts, total }, categories] = await Promise.all([getBlogPosts({ category, page }), getBlogCategories()]);
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (category) sp.set("category", category);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/blog${s ? `?${s}` : ""}`;
  };
  const chip = "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors";
  return (
    <>
      {categories.length ? (
        <nav aria-label="Blog categories" className="mb-10 flex flex-wrap gap-2">
          <Link href="/blog" className={cn(chip, !category ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")} aria-current={!category ? "page" : undefined}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/blog?category=${encodeURIComponent(c)}`}
              className={cn(chip, category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              aria-current={category === c ? "page" : undefined}
            >
              {c}
            </Link>
          ))}
        </nav>
      ) : null}
      {posts.length ? (
        <>
          <div className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <PostCard key={p.id} post={p} large={i === 0 && page === 1 && !category} />
            ))}
          </div>
          <SimplePagination page={page} total={total} pageSize={BLOG_PAGE_SIZE} hrefFor={hrefFor} />
        </>
      ) : (
        <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-12 text-center">
          <p className="font-heading text-xl font-semibold">{category ? "No articles in this category yet" : "The first articles are being written"}</p>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Subscribe below to get new guides by email.</p>
        </div>
      )}
    </>
  );
}

export default function BlogPage({ searchParams }: PageProps<"/blog">) {
  return (
    <>
      <PageIntro title="Guides and resources" description="Practical articles on selling online, building websites and apps, SEO and marketing." />
      <Container className="py-12 sm:py-16">
        <Suspense
          fallback={
            <div className="grid gap-6 md:grid-cols-3" aria-busy="true" aria-label="Loading articles">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[16/10] rounded-2xl" />
              ))}
            </div>
          }
        >
          <PostList searchParams={searchParams} />
        </Suspense>
        <section className="mt-20 grid gap-6 rounded-3xl border bg-card p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Get new guides by email</h2>
            <p className="mt-2 text-muted-foreground">A short email when we publish something useful. No spam.</p>
          </div>
          <NewsletterForm source="blog" />
        </section>
      </Container>
    </>
  );
}
