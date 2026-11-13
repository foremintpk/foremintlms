import "server-only";
import { getIntegration, IntegrationNotConfiguredError } from "@/lib/services/integrations";
import { toZoomStartTime } from "./time";
import {
  ProviderApiError,
  type MeetingDetails,
  type MeetingInput,
  type OAuthTokens,
  type ProviderParticipant,
  type ProviderRecording,
} from "./types";

/**
 * Zoom (user-managed OAuth app). Docs:
 * - OAuth: https://developers.zoom.us/docs/integrations/oauth/
 * - Meetings API: https://developers.zoom.us/docs/api/meetings/
 * Scopes are configured on the Zoom app itself (see docs/teaching-live.md).
 */

const AUTH_BASE = "https://zoom.us/oauth";
const API_BASE = "https://api.zoom.us/v2";

async function config() {
  const zoom = await getIntegration("zoom");
  if (!zoom.clientId || !zoom.clientSecret || !zoom.redirectUri) throw new IntegrationNotConfiguredError("zoom");
  return zoom as { clientId: string; clientSecret: string; redirectUri: string; webhookSecretToken?: string };
}

export async function zoomAuthorizeUrl(state: string): Promise<string> {
  const c = await config();
  const url = new URL(`${AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("redirect_uri", c.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(body: URLSearchParams): Promise<OAuthTokens> {
  const c = await config();
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new ProviderApiError("zoom", res.status, [json.error, json.reason].filter(Boolean).join(": ") || "Zoom rejected the authorization");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? 3600,
    scope: json.scope ?? null,
  };
}

export async function exchangeZoomCode(code: string): Promise<OAuthTokens> {
  const c = await config();
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri }));
}

export async function refreshZoomToken(refreshToken: string): Promise<OAuthTokens> {
  return tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function revokeZoomToken(token: string): Promise<void> {
  const c = await config();
  await fetch(`${AUTH_BASE}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  }).catch(() => undefined);
}

async function zoomApi<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => null)) as (T & { message?: string; code?: number }) | null;
  if (!res.ok) {
    throw new ProviderApiError("zoom", res.status, json?.message || `Zoom API error (${res.status})`);
  }
  return json;
}

export async function getZoomUser(accessToken: string): Promise<{ id: string; email: string | null }> {
  const me = await zoomApi<{ id: string; email?: string }>(accessToken, "GET", "/users/me");
  return { id: me?.id ?? "", email: me?.email ?? null };
}

function meetingBody(input: MeetingInput) {
  return {
    topic: input.title.slice(0, 200),
    type: 2, // scheduled meeting
    start_time: toZoomStartTime(input.startsAt),
    duration: input.durationMinutes,
    timezone: input.timezone,
    agenda: (input.description ?? "").slice(0, 2000),
    settings: {
      join_before_host: false,
      waiting_room: true,
      mute_upon_entry: true,
      participant_video: false,
      host_video: true,
    },
  };
}

export async function createZoomMeeting(accessToken: string, input: MeetingInput): Promise<MeetingDetails> {
  const meeting = await zoomApi<{ id: number; join_url: string; password?: string }>(
    accessToken,
    "POST",
    "/users/me/meetings",
    meetingBody(input),
  );
  if (!meeting?.id || !meeting.join_url) throw new ProviderApiError("zoom", 500, "Zoom did not return a meeting");
  return { externalMeetingId: String(meeting.id), joinUrl: meeting.join_url, passcode: meeting.password ?? null };
}

export async function updateZoomMeeting(accessToken: string, meetingId: string, input: MeetingInput): Promise<void> {
  await zoomApi(accessToken, "PATCH", `/meetings/${encodeURIComponent(meetingId)}`, meetingBody(input));
}

export async function deleteZoomMeeting(accessToken: string, meetingId: string): Promise<void> {
  try {
    await zoomApi(accessToken, "DELETE", `/meetings/${encodeURIComponent(meetingId)}`);
  } catch (err) {
    // Already deleted on Zoom's side — nothing left to cancel.
    if (err instanceof ProviderApiError && err.status === 404) return;
    throw err;
  }
}

/** Meeting UUIDs that start with "/" or contain "//" must be double-encoded. */
export function encodeZoomMeetingRef(ref: string): string {
  return ref.startsWith("/") || ref.includes("//") ? encodeURIComponent(encodeURIComponent(ref)) : encodeURIComponent(ref);
}

/** Cloud recordings for the latest instance of a meeting (needs a paid plan with cloud recording). */
export async function listZoomRecordings(accessToken: string, meetingRef: string): Promise<ProviderRecording[]> {
  const data = await zoomApi<{
    uuid?: string;
    topic?: string;
    start_time?: string;
    duration?: number;
    share_url?: string;
    password?: string;
    recording_play_passcode?: string;
  }>(accessToken, "GET", `/meetings/${encodeZoomMeetingRef(meetingRef)}/recordings`);
  if (!data?.share_url) return [];
  return [
    {
      externalId: data.uuid ?? meetingRef,
      title: data.topic ?? null,
      url: data.share_url,
      passcode: data.password ?? data.recording_play_passcode ?? null,
      durationSeconds: data.duration ? data.duration * 60 : null,
      recordedAt: data.start_time ?? null,
    },
  ];
}

/** Participants of the most recent past instance (Pro plan or higher). */
export async function listZoomPastParticipants(accessToken: string, meetingRef: string): Promise<ProviderParticipant[]> {
  const out: ProviderParticipant[] = [];
  let next = "";
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ page_size: "300", ...(next ? { next_page_token: next } : {}) });
    const data = await zoomApi<{
      participants?: { name?: string; user_email?: string; join_time?: string; leave_time?: string; duration?: number }[];
      next_page_token?: string;
    }>(accessToken, "GET", `/past_meetings/${encodeZoomMeetingRef(meetingRef)}/participants?${query}`);
    for (const p of data?.participants ?? []) {
      out.push({
        name: p.name ?? null,
        email: p.user_email || null,
        joinedAt: p.join_time ?? null,
        leftAt: p.leave_time ?? null,
        durationSeconds: typeof p.duration === "number" ? p.duration : null,
      });
    }
    next = data?.next_page_token ?? "";
    if (!next) break;
  }
  return out;
}
