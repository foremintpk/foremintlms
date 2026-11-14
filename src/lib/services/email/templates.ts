/**
 * Catalog of template variables. Used by the admin editor (to list the
 * {{variables}} each email understands) and for preview/test sends.
 * Pure data — safe to import anywhere.
 */

export interface TemplateVariable {
  name: string;
  description: string;
  sample: string;
}

const v = (name: string, description: string, sample: string): TemplateVariable => ({ name, description, sample });

const FIRST_NAME = v("first_name", "Recipient's first name", "Amira");
const COURSE = v("course_title", "Course title", "Shopify Store Launch");
const PRODUCT = v("product_name", "Product or plan purchased", "Shopify Store Launch — 90 days");
const INVOICE_NUMBER = v("invoice_number", "Foremint invoice number", "FMA-INV-2026-001001");
const INVOICE_DESCRIPTION = v("invoice_description", "What is being purchased", "Custom Digital Business Training Package — 2026");
const AMOUNT = v("amount", "Amount due", "$500.00");
const ACCESS_SUMMARY = v("access_summary", "Sentence about the access period", "Access runs until 12 May 2027.");
const COURSE_LIST = v("course_list", "Courses in the package", "Amazon FBA Foundations, Shopify Store Launch, Digital Marketing Fundamentals");
const COMPANY_NAME = v("company_name", "Company name", "ABC Digital Solutions");
const PACKAGE_NAME = v("package_name", "Package name", "ABC Digital Solutions — Custom Digital Business Training Package");

export const GLOBAL_VARIABLES: TemplateVariable[] = [
  v("brand_name", "Academy name from settings", "Foremint Academy"),
  v("support_email", "Support address from settings", "support@example.com"),
];

export const TEMPLATE_VARIABLES: Record<string, TemplateVariable[]> = {
  "auth.verify_email": [FIRST_NAME],
  "auth.welcome": [FIRST_NAME],
  "auth.password_reset": [FIRST_NAME],
  "auth.password_changed": [FIRST_NAME, v("changed_at", "When the password changed", "14 Nov 2026, 09:12 UTC")],
  "auth.new_account_security": [FIRST_NAME, v("signed_in_at", "When the sign-in happened", "14 Nov 2026, 09:12 UTC"), v("device", "Browser and operating system", "Chrome on Windows")],
  "auth.teacher_invitation": [
    FIRST_NAME,
    v("inviter_name", "Administrator who sent the invitation", "Jordan Lee"),
    v("message", "Optional personal message", "We'd love you to teach our SEO programme."),
    v("expires_at", "Invitation expiry date", "21 Nov 2026"),
  ],
  "system.teacher_approved": [FIRST_NAME],
  "billing.payment_confirmation": [FIRST_NAME, PRODUCT],
  "billing.enrollment_confirmation": [FIRST_NAME, COURSE, v("access_summary", "How long access lasts", "Your access runs until 12 Feb 2027.")],
  "billing.receipt_available": [FIRST_NAME, PRODUCT, v("document_number", "Receipt number", "FMA-R-2026-001042")],
  "billing.payment_failed": [FIRST_NAME, PRODUCT, v("failure_reason", "Reason reported by the payment provider", "Your card was declined.")],
  "billing.refund_processed": [FIRST_NAME, PRODUCT, v("amount", "Refunded amount", "$49.00")],
  "billing.subscription_renewed": [FIRST_NAME, PRODUCT, v("renews_at", "Next renewal date", "14 Dec 2026")],
  "billing.subscription_expiring": [FIRST_NAME, PRODUCT, v("ends_at", "When the subscription ends", "30 Nov 2026")],
  "billing.access_expiring": [FIRST_NAME, COURSE, v("ends_at", "When access ends", "21 Nov 2026"), v("progress", "Course progress", "64%")],
  "billing.access_expired": [FIRST_NAME, COURSE, v("ended_at", "When access ended", "14 Nov 2026")],
  "billing.cancellation_confirmation": [FIRST_NAME, PRODUCT, v("access_until", "Sentence about remaining access", "You keep access until 30 Nov 2026.")],
  "learning.course_enrolled": [FIRST_NAME, COURSE],
  "learning.new_course_announcement": [FIRST_NAME, COURSE, v("course_summary", "Short course description", "Set up, design and launch a Shopify store.")],
  "learning.live_class_scheduled": [
    FIRST_NAME,
    v("session_title", "Live class title", "Store launch Q&A"),
    COURSE,
    v("session_time", "Date and time", "Thu 20 Nov, 17:00 UTC"),
    v("provider_name", "Meeting platform", "Zoom"),
    v("session_description", "Class description", "Bring your store link and questions."),
  ],
  "learning.live_class_reminder": [
    FIRST_NAME,
    v("starts_in", "Relative start", "in 1 hour"),
    v("session_title", "Live class title", "Store launch Q&A"),
    COURSE,
    v("session_time", "Date and time", "Thu 20 Nov, 17:00 UTC"),
    v("provider_name", "Meeting platform", "Zoom"),
  ],
  "learning.live_class_updated": [
    FIRST_NAME,
    v("session_title", "Live class title", "Store launch Q&A"),
    COURSE,
    v("session_time", "New date and time", "Fri 21 Nov, 18:00 UTC"),
    v("provider_name", "Meeting platform", "Google Meet"),
  ],
  "learning.live_class_canceled": [
    FIRST_NAME,
    v("session_title", "Live class title", "Store launch Q&A"),
    COURSE,
    v("session_time", "Original date and time", "Thu 20 Nov, 17:00 UTC"),
    v("reason", "Optional reason", "The instructor is unwell; a new date will follow."),
  ],
  "learning.assignment_deadline": [
    FIRST_NAME,
    v("due_in", "Relative due time", "in 24 hours"),
    v("assignment_title", "Assignment title", "Draft your product listing"),
    COURSE,
    v("due_at", "Due date", "15 Nov 2026, 23:59 UTC"),
  ],
  "learning.assignment_graded": [
    FIRST_NAME,
    v("assignment_title", "Assignment title", "Draft your product listing"),
    COURSE,
    v("status", "Review outcome", "Approved"),
    v("grade_summary", "Grade details", "You scored 86/100."),
  ],
  "learning.instructor_feedback": [FIRST_NAME, v("instructor_name", "Instructor name", "Jordan Lee"), v("assignment_title", "Assignment title", "Draft your product listing"), COURSE],
  "learning.certificate_issued": [FIRST_NAME, COURSE, v("certificate_number", "Certificate number", "FMA-2026-7K3Q9XPA")],
  "learning.course_submitted": [v("instructor_name", "Instructor who submitted", "Jordan Lee"), COURSE],
  "learning.course_review_result": [FIRST_NAME, COURSE, v("review_result", "Outcome", "approved and published"), v("review_notes", "Reviewer notes", "Great structure — published today.")],
  "communication.new_message": [FIRST_NAME, v("sender_name", "Who sent the message", "Jordan Lee"), v("preview", "Message preview", "Thanks for submitting — one quick question…")],
  "communication.discussion_reply": [
    FIRST_NAME,
    v("author_name", "Reply author", "Sam Carter"),
    v("discussion_title", "Discussion title", "How do you price your first products?"),
    COURSE,
    v("preview", "Reply preview", "I started with a 3× markup on landed cost…"),
  ],
  "communication.mention": [FIRST_NAME, v("author_name", "Who mentioned you", "Sam Carter"), COURSE, v("preview", "Message preview", "@Amira that's a great point about shipping…")],
  "communication.ticket_created": [FIRST_NAME, v("ticket_number", "Ticket number", "FMA-1042"), v("ticket_subject", "Ticket subject", "Can't download a resource")],
  "communication.ticket_replied": [FIRST_NAME, v("ticket_number", "Ticket number", "FMA-1042"), v("ticket_subject", "Ticket subject", "Can't download a resource"), v("preview", "Reply preview", "Thanks — that file is fixed now.")],
  "communication.ticket_resolved": [FIRST_NAME, v("ticket_number", "Ticket number", "FMA-1042"), v("ticket_subject", "Ticket subject", "Can't download a resource")],
  "communication.staff_ticket_alert": [
    v("requester_name", "Student who opened the ticket", "Amira Haddad"),
    v("ticket_number", "Ticket number", "FMA-1042"),
    v("ticket_priority", "Priority", "high"),
    v("ticket_subject", "Ticket subject", "Can't download a resource"),
  ],
  "communication.announcement": [
    FIRST_NAME,
    v("announcement_title", "Announcement title", "New live workshop series"),
    v("announcement_body", "Announcement text", "Every Thursday this month we're running live store reviews."),
    v("preview", "Short preview", "Every Thursday this month…"),
  ],
  "invoice.payment_link": [FIRST_NAME, INVOICE_NUMBER, INVOICE_DESCRIPTION, AMOUNT, v("due_date", "Payment due date", "28 Nov 2026")],
  "invoice.reminder": [FIRST_NAME, INVOICE_NUMBER, INVOICE_DESCRIPTION, AMOUNT, v("due_date", "Payment due date", "28 Nov 2026")],
  "invoice.past_due": [FIRST_NAME, INVOICE_NUMBER, INVOICE_DESCRIPTION, AMOUNT, v("due_date", "Payment due date", "28 Nov 2026")],
  "invoice.voided": [FIRST_NAME, INVOICE_NUMBER, INVOICE_DESCRIPTION],
  "invoice.payment_received": [FIRST_NAME, INVOICE_NUMBER, INVOICE_DESCRIPTION, ACCESS_SUMMARY],
  "invoice.account_activation": [FIRST_NAME, INVOICE_DESCRIPTION, COURSE_LIST, ACCESS_SUMMARY, v("expires_at", "When the link expires", "21 Nov 2026")],
  "company.contact_invitation": [FIRST_NAME, COMPANY_NAME, COURSE_LIST, ACCESS_SUMMARY, v("expires_at", "When the link expires", "21 Nov 2026")],
  "company.employee_invitation": [FIRST_NAME, COMPANY_NAME, v("inviter_name", "Who sent the invitation", "John Smith"), COURSE_LIST, ACCESS_SUMMARY, v("expires_at", "When the link expires", "21 Nov 2026")],
  "company.access_activated": [FIRST_NAME, COMPANY_NAME, COURSE_LIST, ACCESS_SUMMARY],
  "company.member_joined": [FIRST_NAME, COMPANY_NAME, v("member_name", "New member", "Sara Khan"), v("member_email", "New member email", "sara@company.com")],
  "company.member_removed": [FIRST_NAME, COMPANY_NAME],
  "company.package_renewed": [FIRST_NAME, PACKAGE_NAME, ACCESS_SUMMARY],
  "company.access_expiring": [FIRST_NAME, PACKAGE_NAME, v("ends_at", "When access ends", "12 May 2027")],
  "company.access_expired": [FIRST_NAME, PACKAGE_NAME, v("ended_at", "When access ended", "12 May 2027")],
  "communication.contact_received": [
    v("lead_name", "Name from the contact form", "Amira Haddad"),
    v("lead_email", "Email from the contact form", "amira@example.com"),
    v("lead_message", "Message", "Do you offer team plans?"),
    v("preview", "Short preview", "Do you offer team plans?"),
  ],
};

/** Templates whose links grant account access — their links are never shown in admin views. */
export const SENSITIVE_LINK_TEMPLATES = new Set([
  "auth.verify_email",
  "auth.password_reset",
  "auth.teacher_invitation",
  "invoice.account_activation",
  "company.contact_invitation",
  "company.employee_invitation",
]);

export function variablesFor(key: string): TemplateVariable[] {
  return [...(TEMPLATE_VARIABLES[key] ?? [FIRST_NAME]), ...GLOBAL_VARIABLES];
}

export function samplePayload(key: string, appUrl: string): Record<string, unknown> {
  const payload: Record<string, unknown> = Object.fromEntries((TEMPLATE_VARIABLES[key] ?? [FIRST_NAME]).map((x) => [x.name, x.sample]));
  payload.cta_url = `${appUrl}/learn`;
  if (key.startsWith("billing.payment") || key === "billing.receipt_available") {
    payload.line_items = [{ description: "Shopify Store Launch — 90 days of access", amount: "$49.00" }];
    payload.total = "$49.00";
  }
  if (key === "auth.new_account_security") {
    payload.details = [
      { label: "Device", value: "Chrome on Windows" },
      { label: "IP address", value: "203.0.113.24" },
    ];
  }
  return payload;
}

/** Remove account-granting links before showing a stored payload to staff. */
export function redactPayload(key: string, payload: Record<string, unknown>): Record<string, unknown> {
  if (!SENSITIVE_LINK_TEMPLATES.has(key)) return payload;
  const copy = { ...payload };
  if ("cta_url" in copy) copy.cta_url = "[hidden — single-use sign-in link]";
  return copy;
}
