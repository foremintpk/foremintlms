import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { isIntegrationConfigured } from "@/lib/services/integrations";
import * as zoom from "./zoom";
import * as meet from "./google-meet";
import {
  PROVIDER_LABEL,
  ProviderApiError,
  ProviderAuthError,
  type MeetingDetails,
  type MeetingInput,
  type MeetingProviderId,
  type OAuthTokens,
  type ProviderConnectionRow,
  type ProviderParticipant,
  type ProviderRecording,
} from "./types";

/** Integration-settings key behind each meeting provider. */
const INTEGRATION: Record<MeetingProviderId, "zoom" | "google"> = { zoom: "zoom", google_meet: "google" };

export async function isMeetingProviderConfigured(provider: MeetingProviderId): Promise<boolean> {
  return isIntegrationConfigured(INTEGRATION[provider]);
}

export async function getConnection(userId: string, provider: MeetingProviderId): Promise<ProviderConnectionRow | null> {
  const { data } = await createAdminClient()
    .from("meeting_provider_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  return (data as ProviderConnectionRow | null) ?? null;
}

export async function getConnectionById(id: string): Promise<ProviderConnectionRow | null> {
  const { data } = await createAdminClient().from("meeting_provider_connections").select("*").eq("id", id).maybeSingle();
  return (data as ProviderConnectionRow | null) ?? null;
}

/** Public-safe view of a user's connections (no tokens). */
export async function listConnectionSummaries(userId: string) {
  const { data } = await createAdminClient()
    .from("meeting_provider_connections")
    .select("id, provider, account_email, status, last_error, token_expires_at, updated_at")
    .eq("user_id", userId);
  return (data ?? []) as Pick<ProviderConnectionRow, "id" | "provider" | "account_email" | "status" | "last_error" | "token_expires_at" | "updated_at">[];
}

export async function saveConnection(
  userId: string,
  provider: MeetingProviderId,
  tokens: OAuthTokens,
  account: { id: string; email: string | null },
  existingRefreshToken?: string | null,
): Promise<void> {
  const refresh = tokens.refreshToken ?? existingRefreshToken ?? null;
  const { error } = await createAdminClient()
    .from("meeting_provider_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        account_email: account.email,
        external_account_id: account.id,
        access_token_enc: encryptSecret(tokens.accessToken),
        refresh_token_enc: refresh ? encryptSecret(refresh) : null,
        token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        scopes: tokens.scope ? tokens.scope.split(/[\s,]+/).filter(Boolean) : [],
        status: "connected",
        last_error: null,
      },
      { onConflict: "user_id,provider" },
    );
  if (error) throw new Error(`Saving ${provider} connection failed: ${error.message}`);
}

async function markConnection(id: string, status: ProviderConnectionRow["status"], lastError: string | null) {
  await createAdminClient().from("meeting_provider_connections").update({ status, last_error: lastError?.slice(0, 500) ?? null }).eq("id", id);
}

/**
 * A usable access token for the connection, refreshed when it expires within
 * two minutes. Refresh failures mark the connection expired so the instructor
 * is asked to reconnect.
 */
export async function getAccessToken(connection: ProviderConnectionRow): Promise<string> {
  const label = PROVIDER_LABEL[connection.provider];
  if (connection.status === "revoked") throw new ProviderAuthError(connection.provider, `${label} was disconnected. Reconnect it in Settings → Meeting accounts.`);
  if (!connection.access_token_enc) throw new ProviderAuthError(connection.provider, `${label} is not connected.`);

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 120_000 && connection.status === "connected") {
    return decryptSecret(connection.access_token_enc);
  }
  if (!connection.refresh_token_enc) {
    await markConnection(connection.id, "expired", "Access expired and no refresh token is available.");
    throw new ProviderAuthError(connection.provider, `${label} access expired. Reconnect it in Settings → Meeting accounts.`);
  }
  const refreshToken = decryptSecret(connection.refresh_token_enc);
  try {
    const tokens =
      connection.provider === "zoom" ? await zoom.refreshZoomToken(refreshToken) : await meet.refreshGoogleToken(refreshToken);
    await saveConnection(
      connection.user_id,
      connection.provider,
      tokens,
      { id: connection.external_account_id ?? "", email: connection.account_email },
      refreshToken,
    );
    return tokens.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token refresh failed";
    if (err instanceof ProviderApiError && err.status >= 400 && err.status < 500) {
      await markConnection(connection.id, "expired", message);
      throw new ProviderAuthError(connection.provider, `${label} access expired. Reconnect it in Settings → Meeting accounts.`);
    }
    await markConnection(connection.id, "error", message);
    throw err;
  }
}

export async function disconnectProvider(userId: string, provider: MeetingProviderId): Promise<void> {
  const connection = await getConnection(userId, provider);
  if (!connection) return;
  // Best effort: tell the provider to revoke our grant, then forget the tokens.
  try {
    const token = connection.refresh_token_enc
      ? decryptSecret(connection.refresh_token_enc)
      : connection.access_token_enc
        ? decryptSecret(connection.access_token_enc)
        : null;
    if (token) {
      if (provider === "zoom") await zoom.revokeZoomToken(token);
      else await meet.revokeGoogleToken(token);
    }
  } catch (err) {
    console.error(`[live] revoke ${provider} token failed`, err);
  }
  await createAdminClient().from("meeting_provider_connections").delete().eq("id", connection.id);
}

// ---------------------------------------------------------------------------
// Meeting operations
// ---------------------------------------------------------------------------

export async function createProviderMeeting(connection: ProviderConnectionRow, input: MeetingInput): Promise<MeetingDetails> {
  const token = await getAccessToken(connection);
  return connection.provider === "zoom" ? zoom.createZoomMeeting(token, input) : meet.createMeetSpace(token);
}

/** Zoom meetings carry the schedule; Meet spaces don't, so nothing to update there. */
export async function updateProviderMeeting(connection: ProviderConnectionRow, meetingId: string, input: MeetingInput): Promise<void> {
  if (connection.provider !== "zoom") return;
  const token = await getAccessToken(connection);
  await zoom.updateZoomMeeting(token, meetingId, input);
}

export async function cancelProviderMeeting(connection: ProviderConnectionRow, meetingId: string): Promise<void> {
  const token = await getAccessToken(connection);
  if (connection.provider === "zoom") await zoom.deleteZoomMeeting(token, meetingId);
  else await meet.endMeetConference(token, meetingId);
}

export interface ProviderArtifacts {
  recordings: ProviderRecording[];
  participants: ProviderParticipant[];
  /** Human explanation of anything the provider/plan didn't allow. */
  notes: string[];
}

function explain(provider: MeetingProviderId, what: "recordings" | "attendance", err: unknown): string {
  const label = PROVIDER_LABEL[provider];
  if (err instanceof ProviderApiError) {
    if (err.status === 401 || err.status === 403) {
      return provider === "zoom"
        ? `${label} ${what} aren't available for this account (needs a paid plan${what === "recordings" ? " with cloud recording" : ""} and the matching app scope).`
        : `${label} ${what} aren't available for this account (requires a Google Workspace edition that supports it).`;
    }
    if (err.status === 404) return `${label} has no ${what} for this meeting yet.`;
    return `${label} ${what} couldn't be fetched (${err.message}).`;
  }
  return `${label} ${what} couldn't be fetched.`;
}

/** Recordings and participants where the provider and plan allow it. Never throws for plan limits. */
export async function fetchProviderArtifacts(connection: ProviderConnectionRow, meetingId: string): Promise<ProviderArtifacts> {
  const token = await getAccessToken(connection);
  const result: ProviderArtifacts = { recordings: [], participants: [], notes: [] };

  if (connection.provider === "zoom") {
    try {
      result.recordings = await zoom.listZoomRecordings(token, meetingId);
    } catch (err) {
      result.notes.push(explain("zoom", "recordings", err));
    }
    try {
      result.participants = await zoom.listZoomPastParticipants(token, meetingId);
    } catch (err) {
      result.notes.push(explain("zoom", "attendance", err));
    }
    return result;
  }

  let records: Awaited<ReturnType<typeof meet.listConferenceRecords>> = [];
  try {
    records = await meet.listConferenceRecords(token, meetingId);
  } catch (err) {
    result.notes.push(explain("google_meet", "attendance", err));
    return result;
  }
  if (records.length === 0) {
    result.notes.push("Google Meet has no conference record for this space yet.");
    return result;
  }
  for (const record of records) {
    try {
      result.participants.push(...(await meet.listMeetParticipants(token, record.name)));
    } catch (err) {
      result.notes.push(explain("google_meet", "attendance", err));
    }
    try {
      result.recordings.push(...(await meet.listMeetRecordings(token, record.name)));
    } catch (err) {
      result.notes.push(explain("google_meet", "recordings", err));
    }
  }
  return result;
}

/** Admin → Integrations "Test connection". OAuth is per instructor, so this checks app credentials. */
export async function testMeetingProvider(id: MeetingProviderId): Promise<{ ok: boolean; message: string }> {
  const label = PROVIDER_LABEL[id];
  if (!(await isMeetingProviderConfigured(id))) {
    return {
      ok: false,
      message: `${label} app credentials are missing. Add the client ID, client secret and redirect URI${id === "zoom" ? " (and webhook secret token)" : ""}.`,
    };
  }
  try {
    // A real request proves the client credentials are accepted by the provider:
    // an obviously invalid code must be rejected as "invalid grant", not "invalid client".
    if (id === "zoom") await zoom.exchangeZoomCode("foremint-connection-test");
    else await meet.exchangeGoogleCode("foremint-connection-test");
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("invalid client") || message.includes("invalid_client") || message.includes("unauthorized_client")) {
      return { ok: false, message: `${label} rejected the client ID or secret.` };
    }
  }
  const { count } = await createAdminClient()
    .from("meeting_provider_connections")
    .select("id", { count: "exact", head: true })
    .eq("provider", id)
    .eq("status", "connected");
  return {
    ok: true,
    message: `${label} app credentials are accepted. ${count ?? 0} instructor account${count === 1 ? " is" : "s are"} connected — each instructor connects their own account in Settings → Meeting accounts.`,
  };
}
