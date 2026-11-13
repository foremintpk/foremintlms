/** Row shapes for public (published) data read by the marketing site. */

export type CourseLevel = "beginner" | "intermediate" | "advanced" | "all_levels";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  accent_color: string | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
}

export interface CategorySummary extends CategoryRow {
  courseCount: number;
}

export interface PublicPlan {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  plan_type: "free" | "one_time" | "recurring";
  currency: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  access_duration_days: number | null;
  billing_period_days: number | null;
  trial_days: number | null;
  stock_limit: number | null;
  units_sold: number;
  available_from: string | null;
  available_until: string | null;
  promo_label: string | null;
  visibility: "public" | "hidden" | "archived";
  is_featured: boolean;
  sort_order: number;
  /** Computed when loaded (inside the cache scope). */
  available: boolean;
  unavailableReason: "archived" | "not_started" | "ended" | "sold_out" | null;
  priceLabel: string;
  accessLabel: string;
  remaining: number | null;
}

export interface PublicProduct {
  id: string;
  kind: "course" | "bundle" | "membership";
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  course_id: string | null;
  grants_all_courses: boolean;
  is_featured: boolean;
  sort_order: number;
  plans: PublicPlan[];
  courses: { id: string; slug: string; title: string }[];
  headline: string | null;
  highlights: string[];
}

export interface InstructorSummary {
  user_id: string;
  slug: string;
  public_name: string;
  headline: string | null;
  avatar_url: string | null;
  expertise: string[];
}

export interface InstructorProfile extends InstructorSummary {
  bio: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  is_featured: boolean;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  thumbnail_url: string | null;
  level: CourseLevel;
  is_free: boolean;
  is_featured: boolean;
  category: { slug: string; name: string } | null;
  instructors: { slug: string; public_name: string }[];
  lessonCount: number;
  durationMinutes: number | null;
  rating: { average: number; count: number } | null;
  /** e.g. "Free", "$49", "From $19 / month" — null when no public plan exists. */
  priceLabel: string | null;
  /** e.g. "Lifetime access", "90 days of access", "Access while subscribed". */
  accessLabel: string | null;
}

export interface OutlineLesson {
  id: string;
  title: string;
  lesson_type: string;
  duration_minutes: number | null;
  is_preview: boolean;
}

export interface OutlineModule {
  id: string;
  title: string;
  description: string | null;
  lessons: OutlineLesson[];
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  verified_enrollment: boolean;
  reviewer_name: string;
}

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  banner_url: string | null;
  level: CourseLevel;
  language: string;
  estimated_duration_minutes: number | null;
  learning_outcomes: string[];
  requirements: string[];
  target_audience: string[];
  tags: string[];
  is_free: boolean;
  certificate_enabled: boolean;
  status: string;
  visibility: string;
  category: CategoryRow | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
  instructors: InstructorProfile[];
  modules: OutlineModule[];
  lessonCount: number;
  totalLessonMinutes: number;
  rating: { average: number; count: number } | null;
}

export interface TestimonialRow {
  id: string;
  person_name: string;
  person_role: string | null;
  company: string | null;
  avatar_url: string | null;
  quote: string;
  rating: number | null;
  is_featured: boolean;
  course: { slug: string; title: string } | null;
}

export interface CaseStudyRow {
  id: string;
  slug: string;
  kind: "case_study" | "success_story";
  title: string;
  summary: string | null;
  cover_image_url: string | null;
  customer_name: string | null;
  business_name: string | null;
  challenge: string | null;
  approach: string | null;
  implementation: string | null;
  outcome: string | null;
  media: { type?: string; url?: string; caption?: string }[];
  course_ids: string[];
  is_featured: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[];
  reading_minutes: number | null;
  published_at: string | null;
}

export interface BlogPost extends BlogPostSummary {
  body: string;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

export interface ProgramSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  level: CourseLevel;
  is_featured: boolean;
  courseCount: number;
}

export interface ProgramDetail extends ProgramSummary {
  description: string | null;
  courses: (CourseCard & { is_required: boolean })[];
}

export interface LegalVersion {
  id: string;
  version: number;
  body: string;
  change_summary: string | null;
  effective_date: string;
  status: "published" | "superseded" | "draft";
  published_at: string | null;
}

export interface LegalDocumentView {
  slug: string;
  title: string;
  current: LegalVersion | null;
  history: Omit<LegalVersion, "body">[];
}
