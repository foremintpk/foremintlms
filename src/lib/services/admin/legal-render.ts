import "server-only";
import { appUrl } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";
import { fillPlaceholders, sanitizeRichText } from "@/lib/sanitize";
import { missingPlaceholders } from "./legal";

/** Fill legal placeholders from platform settings and sanitise the result. */
export async function renderLegalBody(body: string): Promise<{ html: string; missing: string[] }> {
  const s = await getPublicSettings();
  const values = {
    entity_name: s.legalEntityName,
    business_address: s.businessAddress,
    support_email: s.supportEmail,
    jurisdiction: s.jurisdiction,
    site_url: appUrl(),
  };
  const withRegistration = body.replace(
    /\{\{\s*registration_number\s*\}\}/gi,
    s.registrationNumber ? ` (registration number ${s.registrationNumber})` : "",
  );
  return {
    html: sanitizeRichText(fillPlaceholders(withRegistration, values)),
    missing: missingPlaceholders(body, values),
  };
}
