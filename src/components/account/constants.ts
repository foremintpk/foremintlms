export const NOTIFICATION_CATEGORIES = [
  { key: "learning", label: "Learning", description: "Enrollments, new lessons, assignment feedback and certificates." },
  { key: "live", label: "Live classes", description: "New sessions, schedule changes and reminders before a class starts." },
  { key: "billing", label: "Billing and access", description: "Renewals and access ending. Receipts and failed payments are always emailed." },
  { key: "messages", label: "Messages", description: "New private messages from instructors and the academy team." },
  { key: "discussions", label: "Discussions", description: "Replies to your posts and mentions in course discussions." },
  { key: "support", label: "Support", description: "Replies and status changes on your support tickets." },
  { key: "marketing", label: "News and offers", description: "Occasional updates about new courses and programmes." },
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export const ACCOUNT_TABS = ["profile", "security", "notifications", "privacy"] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function parseAccountTab(value: unknown): AccountTab {
  return typeof value === "string" && (ACCOUNT_TABS as readonly string[]).includes(value) ? (value as AccountTab) : "profile";
}
