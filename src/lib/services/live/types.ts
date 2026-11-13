/** Shared types for live classes and meeting providers. */

export type MeetingProviderId = "zoom" | "google_meet";
export type LiveProvider = MeetingProviderId | "external";
export type LiveSessionStatus = "scheduled" | "live" | "completed" | "canceled";

export const PROVIDER_LABEL: Record<LiveProvider, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  external: "External link",
};

export interface ProviderConnectionRow {
  id: string;
  user_id: string;
  provider: MeetingProviderId;
  account_email: string | null;
  external_account_id: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: "connected" | "expired" | "revoked" | "error";
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveSessionRow {
  id: string;
  course_id: string;
  host_id: string | null;
  title: string;
  description: string | null;
  provider: LiveProvider;
  provider_connection_id: string | null;
  external_meeting_id: string | null;
  join_url: string | null;
  meeting_passcode: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  status: LiveSessionStatus;
  announcement: string | null;
  canceled_reason: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  provider_sync_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingInput {
  title: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
}

export interface MeetingDetails {
  externalMeetingId: string;
  joinUrl: string;
  passcode: string | null;
}

export interface ProviderRecording {
  externalId: string;
  title: string | null;
  url: string;
  passcode: string | null;
  durationSeconds: number | null;
  recordedAt: string | null;
}

export interface ProviderParticipant {
  name: string | null;
  email: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  durationSeconds: number | null;
}

export interface OAuthTokens {
  accessToken: string;
  /** Zoom rotates refresh tokens; Google may omit it on refresh. */
  refreshToken: string | null;
  expiresIn: number;
  scope: string | null;
}

/** Error from a provider API, carrying the HTTP status for plan/permission handling. */
export class ProviderApiError extends Error {
  constructor(
    public readonly provider: MeetingProviderId,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderApiError";
  }
}

/** The instructor's provider connection can no longer be used (revoked/expired). */
export class ProviderAuthError extends Error {
  constructor(public readonly provider: MeetingProviderId, message: string) {
    super(message);
    this.name = "ProviderAuthError";
  }
}

/** Whether the current user can create meetings with a provider right now. */
export type ProviderAvailability = "connected" | "needs_reconnect" | "not_connected" | "not_configured";
