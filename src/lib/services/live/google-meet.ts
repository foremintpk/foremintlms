import "server-only";
import { getIntegration, IntegrationNotConfiguredError } from "@/lib/services/integrations";
import {
  ProviderApiError,
  type MeetingDetails,
  type OAuthTokens,
  type ProviderParticipant,
  type ProviderRecording,
} from "./types";

/**
 * Google Meet REST API. Docs:
 * - Spaces: https://developers.google.com/workspace/meet/api/guides/meeting-spaces
 * - Scopes: https://developers.google.com/workspace/meet/api/guides/authenticate-authorize
 * - Conference records: https://developers.google.com/workspace/meet/api/guides/conferences
 *
 * `meetings.space.created` lets the app create spaces and read metadata
 * (conference records, participants, recordings) for spaces it created.
 * It is a *sensitive* scope: production use needs Google app verification.
 * Meet spaces have no scheduled time — the schedule lives in our database.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MEET_API = "https://meet.googleapis.com/v2";

export const GOOGLE_MEET_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/meetings.space.created"];

async function config() {
  const google = await getIntegration("google");
  if (!google.clientId || !google.clientSecret || !google.redirectUri) throw new IntegrationNotConfiguredError("google");
  return google as { clientId: string; clientSecret: string; redirectUri: string };
}

export async function googleAuthorizeUrl(state: string): Promise<string> {
  const c = await config();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("redirect_uri", c.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_MEET_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
  const c = await config();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new ProviderApiError(
      "google_meet",
      res.status,
      [json.error, json.error_description].filter(Boolean).join(": ") || "Google rejected the authorization",
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: json.expires_in ?? 3600,
    scope: json.scope ?? null,
  };
}

export async function exchangeGoogleCode(code: string): Promise<OAuthTokens> {
  const c = await config();
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: c.redirectUri });
}

export async function refreshGoogleToken(refreshToken: string): Promise<OAuthTokens> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  }).catch(() => undefined);
}

export async function getGoogleUser(accessToken: string): Promise<{ id: string; email: string | null }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new ProviderApiError("google_meet", res.status, "Could not read the Google account");
  const json = (await res.json()) as { sub: string; email?: string };
  return { id: json.sub, email: json.email ?? null };
}

async function meetApi<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MEET_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new ProviderApiError("google_meet", res.status, json.error?.message || `Google Meet API error (${res.status})`);
  return json;
}

/** Create a meeting space; returns its resource name ("spaces/…") as the meeting id. */
export async function createMeetSpace(accessToken: string): Promise<MeetingDetails> {
  const space = await meetApi<{ name?: string; meetingUri?: string; meetingCode?: string }>(accessToken, "POST", "/spaces", {});
  if (!space.name || !space.meetingUri) throw new ProviderApiError("google_meet", 500, "Google Meet did not return a meeting space");
  return { externalMeetingId: space.name, joinUrl: space.meetingUri, passcode: null };
}

/** Ends an ongoing conference in the space (no-op when none is active). */
export async function endMeetConference(accessToken: string, spaceName: string): Promise<void> {
  try {
    await meetApi(accessToken, "POST", `/${spaceName}:endActiveConference`, {});
  } catch (err) {
    if (err instanceof ProviderApiError && (err.status === 400 || err.status === 404 || err.status === 412)) return;
    throw err;
  }
}

interface ConferenceRecord {
  name: string;
  startTime?: string;
  endTime?: string;
}

export async function listConferenceRecords(accessToken: string, spaceName: string): Promise<ConferenceRecord[]> {
  const filter = encodeURIComponent(`space.name = "${spaceName}"`);
  const data = await meetApi<{ conferenceRecords?: ConferenceRecord[] }>(accessToken, "GET", `/conferenceRecords?filter=${filter}&pageSize=25`);
  return data.conferenceRecords ?? [];
}

/**
 * Participants of a conference. Google returns display names and opaque user
 * ids — not email addresses — so these rows can't be auto-matched to accounts.
 */
export async function listMeetParticipants(accessToken: string, recordName: string): Promise<ProviderParticipant[]> {
  const out: ProviderParticipant[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ pageSize: "100", ...(pageToken ? { pageToken } : {}) });
    const data = await meetApi<{
      participants?: {
        earliestStartTime?: string;
        latestEndTime?: string;
        signedinUser?: { displayName?: string };
        anonymousUser?: { displayName?: string };
        phoneUser?: { displayName?: string };
      }[];
      nextPageToken?: string;
    }>(accessToken, "GET", `/${recordName}/participants?${query}`);
    for (const p of data.participants ?? []) {
      const start = p.earliestStartTime ?? null;
      const end = p.latestEndTime ?? null;
      out.push({
        name: p.signedinUser?.displayName ?? p.anonymousUser?.displayName ?? p.phoneUser?.displayName ?? null,
        email: null,
        joinedAt: start,
        leftAt: end,
        durationSeconds: start && end ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)) : null,
      });
    }
    pageToken = data.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

/** Recordings saved to the organiser's Drive (Workspace editions with Meet recording). */
export async function listMeetRecordings(accessToken: string, recordName: string): Promise<ProviderRecording[]> {
  const data = await meetApi<{
    recordings?: { name: string; state?: string; startTime?: string; endTime?: string; driveDestination?: { exportUri?: string } }[];
  }>(accessToken, "GET", `/${recordName}/recordings`);
  return (data.recordings ?? [])
    .filter((r) => r.state === "FILE_GENERATED" && r.driveDestination?.exportUri)
    .map((r) => ({
      externalId: r.name,
      title: null,
      url: r.driveDestination!.exportUri!,
      passcode: null,
      durationSeconds:
        r.startTime && r.endTime ? Math.round((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 1000) : null,
      recordedAt: r.startTime ?? null,
    }));
}
