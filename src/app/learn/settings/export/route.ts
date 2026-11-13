import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertUser } from "@/lib/auth/guards";
import { apiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * "Download my data": every record the signed-in user owns, read through
 * their own session so Row Level Security limits it to their data.
 */
export async function GET() {
  try {
    const user = await assertUser();
    await enforceRateLimit("data-export", 5, 3600, user.id);
    const supabase = await createClient();
    // Generic "rows owned by me" reader over many tables. The typed client
    // can't express a dynamic table name, so this helper uses the untyped
    // interface; RLS still scopes every read to the signed-in user.
    const db = supabase as unknown as SupabaseClient;
    const mine = (table: string, column = "user_id") => db.from(table).select("*").eq(column, user.id);

    const [
      profile,
      privateDetails,
      preferences,
      notificationPreferences,
      roles,
      teacherProfile,
      enrollments,
      entitlements,
      progress,
      bookmarks,
      notes,
      quizAttempts,
      submissions,
      certificates,
      reviews,
      payments,
      subscriptions,
      billingDocuments,
      tickets,
      sentMessages,
      discussions,
      replies,
      notifications,
      authEvents,
    ] = await Promise.all([
      mine("profiles", "id"),
      mine("profile_private"),
      mine("user_preferences"),
      mine("notification_preferences"),
      mine("user_roles"),
      mine("teacher_profiles"),
      mine("enrollments"),
      mine("course_entitlements"),
      mine("lesson_progress"),
      mine("bookmarks"),
      mine("student_notes"),
      mine("quiz_attempts"),
      mine("assignment_submissions"),
      mine("certificates"),
      mine("course_reviews"),
      mine("payment_transactions"),
      mine("subscription_records"),
      mine("billing_documents"),
      mine("support_tickets", "requester_id"),
      mine("messages", "sender_id"),
      mine("course_discussions", "author_id"),
      mine("discussion_replies", "author_id"),
      mine("notifications"),
      mine("auth_events").order("created_at", { ascending: false }).limit(500),
    ]);

    const attemptIds = ((quizAttempts.data ?? []) as { id: string }[]).map((a) => a.id);
    const submissionIds = ((submissions.data ?? []) as { id: string }[]).map((s) => s.id);
    const ticketIds = ((tickets.data ?? []) as { id: string }[]).map((t) => t.id);
    const [quizAnswers, feedback, ticketMessages] = await Promise.all([
      attemptIds.length ? supabase.from("quiz_answers").select("*").in("attempt_id", attemptIds) : Promise.resolve({ data: [] }),
      submissionIds.length ? supabase.from("assignment_feedback").select("*").in("submission_id", submissionIds) : Promise.resolve({ data: [] }),
      ticketIds.length ? supabase.from("support_ticket_messages").select("*").in("ticket_id", ticketIds) : Promise.resolve({ data: [] }),
    ]);

    const body = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profile.data?.[0] ?? null,
      private_details: privateDetails.data?.[0] ?? null,
      preferences: preferences.data?.[0] ?? null,
      notification_preferences: notificationPreferences.data ?? [],
      roles: roles.data ?? [],
      instructor_profile: teacherProfile.data?.[0] ?? null,
      learning: {
        enrollments: enrollments.data ?? [],
        entitlements: entitlements.data ?? [],
        lesson_progress: progress.data ?? [],
        bookmarks: bookmarks.data ?? [],
        notes: notes.data ?? [],
        quiz_attempts: quizAttempts.data ?? [],
        quiz_answers: quizAnswers.data ?? [],
        assignment_submissions: submissions.data ?? [],
        assignment_feedback: feedback.data ?? [],
        certificates: certificates.data ?? [],
        course_reviews: reviews.data ?? [],
      },
      billing: {
        payments: payments.data ?? [],
        subscriptions: subscriptions.data ?? [],
        documents: billingDocuments.data ?? [],
      },
      communication: {
        support_tickets: tickets.data ?? [],
        support_ticket_messages: ticketMessages.data ?? [],
        messages_sent: sentMessages.data ?? [],
        discussions: discussions.data ?? [],
        discussion_replies: replies.data ?? [],
        notifications: notifications.data ?? [],
      },
      security: { recent_auth_events: authEvents.data ?? [] },
    };

    await audit({ actor: user, action: "account.data_exported", entityType: "user", entityId: user.id, summary: "Downloaded personal data export" });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="foremint-data-${date}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
