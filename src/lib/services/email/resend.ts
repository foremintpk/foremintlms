import "server-only";
import { Resend } from "resend";
import { getIntegration } from "@/lib/services/integrations";
import { getSetting } from "@/lib/settings";

/** A configured Resend client, or null when no API key is available. */
export async function getResendClient(): Promise<Resend | null> {
  const { apiKey } = await getIntegration("resend");
  return apiKey ? new Resend(apiKey) : null;
}

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export interface SenderConfig {
  /** RFC 5322 "Name <address>" or null when no sending address is configured. */
  from: string | null;
  replyTo: string | null;
  address: string | null;
  name: string;
}

/**
 * Sender identity: Admin → Emails sender settings win, then the Resend
 * integration's from address (EMAIL_FROM). The address must be on a domain
 * verified in Resend.
 */
export async function getSenderConfig(): Promise<SenderConfig> {
  const [name, settingAddress, replyTo, integration] = await Promise.all([
    getSetting<string>("email.sender_name", "Foremint Academy"),
    getSetting<string>("email.from_address", ""),
    getSetting<string>("email.reply_to", ""),
    getIntegration("resend"),
  ]);
  const raw = (settingAddress || integration.fromEmail || "").trim();
  let address: string | null = null;
  let from: string | null = null;
  const bracket = /<([^>]+)>/.exec(raw);
  if (bracket && ADDRESS.test(bracket[1].trim())) {
    address = bracket[1].trim();
    from = settingAddress ? `${sanitizeName(name)} <${address}>` : raw;
  } else if (ADDRESS.test(raw)) {
    address = raw;
    from = `${sanitizeName(name)} <${raw}>`;
  }
  return {
    from,
    address,
    name,
    replyTo: ADDRESS.test(replyTo.trim()) ? replyTo.trim() : null,
  };
}

function sanitizeName(name: string): string {
  return name.replace(/[<>"\r\n]/g, "").trim() || "Foremint Academy";
}

/** Validates the API key by listing domains, and reports whether the sender domain is verified. */
export async function testResendConnection(): Promise<{ ok: boolean; message: string }> {
  const client = await getResendClient();
  if (!client) return { ok: false, message: "No Resend API key is configured." };
  try {
    const { data, error } = await client.domains.list();
    if (error) return { ok: false, message: `Resend rejected the request: ${error.message}` };
    const sender = await getSenderConfig();
    if (!sender.address) return { ok: false, message: "API key works, but no sending address is set (EMAIL_FROM or sender settings)." };
    const domain = sender.address.split("@")[1]?.toLowerCase();
    const domains = (data?.data ?? []) as { name: string; status: string }[];
    const match = domains.find((d) => d.name.toLowerCase() === domain || domain?.endsWith(`.${d.name.toLowerCase()}`));
    if (!match) return { ok: false, message: `API key works, but ${domain} is not added in Resend.` };
    if (match.status !== "verified") return { ok: false, message: `API key works, but ${match.name} is ${match.status} (not verified yet).` };
    return { ok: true, message: `Connected. Sending from ${sender.address} (${match.name} verified).` };
  } catch (err) {
    return { ok: false, message: `Could not reach Resend: ${err instanceof Error ? err.message.slice(0, 160) : "unknown error"}` };
  }
}
