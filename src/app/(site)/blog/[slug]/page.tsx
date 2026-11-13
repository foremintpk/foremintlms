import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContent } from "@/components/common/rich-content";
import { NewsletterForm } from "@/components/site/forms";
import { Breadcrumbs, Container, JsonLd, MediaImage } from "@/components/site/primitives";
import { appUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { getBlogPostBySlug, getRecentBlogPosts } from "@/lib/services/public/content";
import { getPublicSettings } from "@/lib/settings";

export const instant = false;

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Article not found", robots: { index: false } };
  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? post.excerpt ?? undefined;
  const url = appUrl(`/blog/${post.slug}`);
  const image = post.cover_image_url ? (post.cover_image_url.startsWith("/") ? appUrl(post.cover_image_url) : post.cover_image_url) : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: post.author_name ? [post.author_name] : undefined,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { title, description },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();
  const [recent, settings] = await Promise.all([getRecentBlogPosts(3, post.id), getPublicSettings()]);
  const author = post.author_name || `${settings.brandName} team`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt ?? undefined,
          datePublished: post.published_at ?? undefined,
          dateModified: post.updated_at,
          author: { "@type": post.author_name ? "Person" : "Organization", name: author },
          publisher: { "@type": "Organization", name: settings.brandName, logo: { "@type": "ImageObject", url: appUrl("/brand/foremint-mark-512.png") } },
          mainEntityOfPage: appUrl(`/blog/${post.slug}`),
          ...(post.cover_image_url ? { image: post.cover_image_url.startsWith("/") ? appUrl(post.cover_image_url) : post.cover_image_url } : {}),
          ...(post.tags.length ? { keywords: post.tags.join(", ") } : {}),
        }}
      />
      <article>
        <header>
          <Container className="max-w-3xl pt-10 sm:pt-14">
            <Breadcrumbs items={[{ label: "Blog", href: "/blog" }, ...(post.category ? [{ label: post.category, href: `/blog?category=${encodeURIComponent(post.category)}` }] : []), { label: post.title }]} />
            <h1 className="mt-6 text-[2.2rem] leading-[1.06] font-bold tracking-[-0.03em] sm:text-[3rem]">{post.title}</h1>
            {post.excerpt ? <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p> : null}
            <p className="mt-6 text-sm text-muted-foreground">
              By <span className="font-medium text-foreground">{author}</span>
              {post.published_at ? <>, {formatDate(post.published_at)}</> : null}
              {post.reading_minutes ? <>, {post.reading_minutes} min read</> : null}
            </p>
          </Container>
        </header>
        {post.cover_image_url ? (
          <Container className="max-w-5xl pt-10">
            <div className="relative aspect-[16/8] overflow-hidden rounded-3xl bg-muted">
              <MediaImage src={post.cover_image_url} alt="" priority sizes="(min-width: 1024px) 1000px, 100vw" />
            </div>
          </Container>
        ) : null}
        <Container className="max-w-3xl py-12">
          <RichContent html={post.body} />
          {post.tags.length ? (
            <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t} className="rounded-full bg-muted px-3 py-1 text-sm">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-12 rounded-3xl border bg-card p-6">
            <p className="font-semibold">Get new guides by email</p>
            <p className="mb-4 text-sm text-muted-foreground">A short email when we publish something useful.</p>
            <NewsletterForm source="blog-post" />
          </div>
        </Container>
      </article>
      {recent.length ? (
        <section className="border-t bg-card py-14">
          <Container>
            <h2 className="mb-6 text-xl font-semibold">More from the blog</h2>
            <ul className="grid gap-6 md:grid-cols-3">
              {recent.map((p) => (
                <li key={p.id} className="group relative">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                    <MediaImage src={p.cover_image_url} alt="" sizes="(min-width: 768px) 33vw, 100vw" />
                  </div>
                  <h3 className="mt-3 font-semibold">
                    <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:text-primary">
                      {p.title}
                    </Link>
                  </h3>
                  {p.published_at ? <p className="text-sm text-muted-foreground">{formatDate(p.published_at)}</p> : null}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}
