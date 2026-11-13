import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PersonRole = "admin" | "teacher" | "student";

export interface PersonCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: PersonRole;
}

export function PersonAvatar({ person, className }: { person: Pick<PersonCard, "name" | "avatarUrl">; className?: string }) {
  return (
    <Avatar className={cn("size-9 ring-1 ring-border", className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-brand-soft text-xs font-semibold text-primary">{initials(person.name)}</AvatarFallback>
    </Avatar>
  );
}

const ROLE_LABEL: Record<PersonRole, string | null> = { admin: "Foremint team", teacher: "Instructor", student: null };

export function RoleBadge({ role, className }: { role: PersonRole; className?: string }) {
  const label = ROLE_LABEL[role];
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
        role === "teacher" ? "bg-brand-soft text-primary" : "bg-info-soft text-info",
        className,
      )}
    >
      {label}
    </span>
  );
}
