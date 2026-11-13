import "server-only";
import { updateTag } from "next/cache";
import { PUBLIC_TAGS, type PublicTag } from "@/lib/services/public/tags";

export { PUBLIC_TAGS };

/** Expire public-site cache entries after an admin change (server actions only). */
export function refreshPublic(...tags: (PublicTag | `${string}:${string}`)[]) {
  for (const tag of new Set(tags)) updateTag(tag);
}
