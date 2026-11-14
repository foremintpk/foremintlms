/** Messages the course advisor API sends to the chat widget. */
import type { CartView } from "./commerce-view";
import type { AdvisorStage } from "./advisor";

export interface AdvisorCourseCard {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  thumbnailUrl: string | null;
  priceMinor: number | null;
  currency: string;
  accessLabel: string | null;
  explanation: string | null;
  role: "primary" | "supporting";
}

export interface AdvisorOption {
  label: string;
  /** Picks a follow-up path (intent key). */
  intent?: string;
  /** Sends this text as the visitor's message. */
  message?: string;
  /** Runs a built-in step. */
  action?: "view_cart" | "coupon" | "request_link" | "checkout";
}

export type AdvisorBlock =
  | { type: "text"; text: string }
  | { type: "courses"; courses: AdvisorCourseCard[] }
  | { type: "options"; question?: string; options: AdvisorOption[] }
  | { type: "faq"; question: string; answer: string }
  | { type: "cart" }
  | { type: "email_request"; suggested: string | null }
  | { type: "coupon_request" }
  | { type: "payment_link"; orderNumber: string; paymentUrl: string | null; statusUrl: string; totalMinor: number; currency: string; expiresAt: string; email: string; free: boolean }
  | { type: "checkout_cta" }
  | { type: "notice"; tone: "error" | "info"; text: string };

export interface AdvisorReply {
  blocks: AdvisorBlock[];
  cart: CartView;
  stage: AdvisorStage;
  limited?: boolean;
}

export type AdvisorRequest =
  | { type: "message"; text: string }
  | { type: "option"; intent: string; label: string }
  | { type: "add"; courseIds: string[] }
  | { type: "remove"; courseId: string }
  | { type: "view_cart" }
  | { type: "coupon"; code?: string }
  | { type: "email"; email: string }
  | { type: "request_link" }
  | { type: "checkout_opened" }
  | { type: "reset" };

export interface AdvisorPublicConfig {
  enabled: boolean;
  greeting: string;
  intro: string;
  privacyNotice: string;
  quickReplies: string[];
  showQuickReplies: boolean;
}
