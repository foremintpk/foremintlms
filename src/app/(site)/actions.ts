"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertUser, AuthError } from "@/lib/auth/guards";
import { enrollInFreeCourse } from "@/lib/services/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { notifyStaffEmail } from "@/lib/services/notifications";
import { getPublicSettings } from "@/lib/settings";
import { appUrl } from "@/lib/env";
import { UserFacingError } from "@/lib/actions";

/** State shape shared by the public forms (useActionState). */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function errorState(err: unknown): FormState {
  if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
  if (err instanceof z.ZodError) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors as Record<string, string[]> };
  }
  if (err instanceof RateLimitError || err instanceof UserFacingError || err instanceof AuthError) {
    return { status: "error", message: err.message };
  }
  console.error("[site:action]", err);
  return { status: "error", message: "Something went wrong. Please try again in a moment." };
}

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

const newsletterSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  source: z.string().max(40).optional(),
});

export async function subscribeToNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  const subscribed: FormState = { status: "success", message: "You're subscribed. Watch your inbox for new courses and guides." };
  // Bots fill the hidden field; respond as if it worked.
  if (String(form.get("website") ?? "")) return subscribed;
  try {
    const input = newsletterSchema.parse({
      email: String(form.get("email") ?? "").trim(),
      source: String(form.get("source") ?? "website").slice(0, 40),
    });
    await enforceRateLimit("newsletter", 5, 600);
    const admin = createAdminClient();
    const email = input.email.toLowerCase();
    const { data: existing } = await admin.from("newsletter_subscriptions").select("id, status").eq("email", email).maybeSingle();
    if (existing) {
      if (existing.status !== "subscribed") {
        const { error } = await admin
          .from("newsletter_subscriptions")
          .update({ status: "subscribed", unsubscribed_at: null, consent_at: new Date().toISOString(), source: input.source ?? "website" })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await admin.from("newsletter_subscriptions").insert({ email, source: input.source ?? "website" });
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    return subscribed;
  } catch (err) {
    return errorState(err);
  }
}

const unsubscribeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/, "This unsubscribe link is invalid.") });

export async function unsubscribeFromNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { token } = unsubscribeSchema.parse({ token: String(form.get("token") ?? "") });
    await enforceRateLimit("newsletter-unsubscribe", 20, 600);
    const { data, error } = await createAdminClient()
      .from("newsletter_subscriptions")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new UserFacingError("We couldn't find that subscription. It may already be removed.");
    return { status: "success", message: "You've been unsubscribed. You won't receive newsletter emails from us." };
  } catch (err) {
    return errorState(err);
  }
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

const TOPICS = {
  general: { label: "General question", source: "contact" },
  courses: { label: "Courses and enrollment", source: "course_interest" },
  billing: { label: "Billing", source: "contact" },
  business: { label: "Business or team training", source: "business" },
  instructor: { label: "Teaching at Foremint Academy", source: "instructor_application" },
} as const;

const contactSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(160),
  email: z.email("Enter a valid email address").max(254),
  phone: z.string().trim().max(40).optional(),
  topic: z.enum(Object.keys(TOPICS) as [keyof typeof TOPICS, ...(keyof typeof TOPICS)[]]),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(5000),
  website: z.string().max(0).optional(),
});

export async function submitContactForm(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const honeypot = String(form.get("website") ?? "");
    if (honeypot) return { status: "success", message: "Thanks — your message has been sent." };
    const input = contactSchema.parse({
      full_name: String(form.get("full_name") ?? ""),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "") || undefined,
      topic: String(form.get("topic") ?? "general"),
      message: String(form.get("message") ?? ""),
    });
    await enforceRateLimit("contact", 5, 600);
    const meta = await getRequestMeta();
    const topic = TOPICS[input.topic];
    const admin = createAdminClient();
    const { data: lead, error } = await admin
      .from("marketing_leads")
      .insert({
        full_name: input.full_name,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        subject: topic.label,
        message: input.message,
        source: topic.source,
        metadata: { topic: input.topic, user_agent: meta.userAgent },
      })
      .select("id")
      .single();
    if (error || !lead) throw new Error(error?.message ?? "lead insert failed");

    const settings = await getPublicSettings();
    await notifyStaffEmail(settings.supportEmail, "communication.contact_received", `lead:${lead.id}`, {
      lead_name: input.full_name,
      lead_email: input.email,
      lead_message: input.message,
      preview: input.message.slice(0, 140),
      cta_url: appUrl("/admin/leads"),
      details: [
        { label: "Topic", value: topic.label },
        ...(input.phone ? [{ label: "Phone", value: input.phone }] : []),
      ],
    });
    return { status: "success", message: "Thanks — your message has been sent. We usually reply within two business days." };
  } catch (err) {
    return errorState(err);
  }
}

// ---------------------------------------------------------------------------
// Free enrollment
// ---------------------------------------------------------------------------

const enrollSchema = z.object({ courseId: z.uuid(), slug: z.string().regex(/^[a-z0-9-]{1,120}$/) });

export async function enrollInFreeCourseAction(_prev: FormState, form: FormData): Promise<FormState> {
  let slug = "";
  try {
    const input = enrollSchema.parse({ courseId: String(form.get("courseId") ?? ""), slug: String(form.get("slug") ?? "") });
    slug = input.slug;
    let user;
    try {
      user = await assertUser();
    } catch (err) {
      if (err instanceof AuthError && err.code === "unauthenticated") {
        redirect(`/register?next=${encodeURIComponent(`/courses/${input.slug}`)}`);
      }
      throw err;
    }
    await enforceRateLimit("enroll-free", 20, 600, user.id);
    await enrollInFreeCourse(user, input.courseId);
  } catch (err) {
    return errorState(err);
  }
  redirect(`/learn/courses/${slug}`);
}
