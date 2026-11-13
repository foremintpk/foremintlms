/**
 * Legal document versioning rules (pure, unit tested).
 * A document has many versions; exactly one may be "published" at a time.
 * Publishing a draft supersedes the previously published version.
 */

export type LegalVersionStatus = "draft" | "published" | "superseded";

export interface LegalVersionLike {
  id: string;
  version: number;
  status: LegalVersionStatus;
}

export function nextVersionNumber(versions: Pick<LegalVersionLike, "version">[]): number {
  return versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
}

export interface PublishPlan {
  publishId: string;
  supersedeIds: string[];
}

/** What publishing `targetId` changes. Throws when the target isn't a draft. */
export function planPublish(versions: LegalVersionLike[], targetId: string): PublishPlan {
  const target = versions.find((v) => v.id === targetId);
  if (!target) throw new Error("Version not found");
  if (target.status !== "draft") throw new Error("Only draft versions can be published");
  return {
    publishId: target.id,
    supersedeIds: versions.filter((v) => v.status === "published" && v.id !== target.id).map((v) => v.id),
  };
}

export function hasOpenDraft(versions: LegalVersionLike[]): boolean {
  return versions.some((v) => v.status === "draft");
}

export const LEGAL_PLACEHOLDERS = [
  "entity_name",
  "business_address",
  "support_email",
  "jurisdiction",
  "site_url",
  "registration_number",
] as const;

/** Placeholders referenced in a body that have no configured value yet. */
export function missingPlaceholders(body: string, values: Partial<Record<(typeof LEGAL_PLACEHOLDERS)[number], string>>): string[] {
  const used = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) used.add(m[1].toLowerCase());
  return [...used].filter((k) => k !== "registration_number" && !values[k as keyof typeof values]);
}
