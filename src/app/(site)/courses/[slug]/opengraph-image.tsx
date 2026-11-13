import { OG_SIZE, renderOgImage } from "@/components/site/og/render";
import { getCourseBySlug } from "@/lib/services/public/catalog";
import { LEVEL_LABEL } from "@/lib/services/public/shape";

export const alt = "Course at Foremint Academy";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return renderOgImage({ title: "Practical courses for the digital economy" });
  const instructors = course.instructors.map((i) => i.public_name).join(", ");
  return renderOgImage({
    title: course.title,
    eyebrow: course.category?.name ?? "Course",
    footer: [LEVEL_LABEL[course.level], instructors ? `with ${instructors}` : null].filter(Boolean).join(", "),
  });
}
