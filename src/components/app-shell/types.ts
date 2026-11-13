import type { AppRole } from "@/lib/auth/session";
import type { BadgeKey } from "./nav-config";

/** Serializable subset of the session user passed to client shell components. */
export interface ShellUser {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  roles: AppRole[];
}

export type ShellBadges = Partial<Record<BadgeKey, number>>;
