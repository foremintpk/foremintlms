import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * The course advisor's mark: a chat bubble with typing dots (it's a chatbot)
 * on the brand gradient, signed with a small Foremint badge, plus an
 * "online" dot. Used on the launcher and in the chat header.
 */
export function AdvisorAvatar({ size = "md", online = true, className }: { size?: "sm" | "md" | "lg"; online?: boolean; className?: string }) {
  const box = size === "lg" ? "size-14 rounded-[20px]" : size === "md" ? "size-11 rounded-2xl" : "size-9 rounded-xl";
  const bubble = size === "lg" ? "size-9" : size === "md" ? "size-7" : "size-6";
  const badge = size === "lg" ? "size-6 -right-1.5 -bottom-1.5" : size === "md" ? "size-5 -right-1 -bottom-1" : "size-4 -right-1 -bottom-1";
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center bg-[linear-gradient(145deg,#8a72ff,var(--brand)_45%,var(--brand-strong))] shadow-raised", box, className)}>
      <svg viewBox="0 0 32 32" className={cn("drop-shadow-sm", bubble)} fill="none">
        <path d="M16 4.5C9.1 4.5 3.5 9.2 3.5 15c0 3.2 1.7 6 4.4 7.9l-1.1 4.6 5.2-2.8c1.3.4 2.6.5 4 .5 6.9 0 12.5-4.7 12.5-10.5S22.9 4.5 16 4.5Z" fill="white" />
        <circle cx="10.6" cy="15" r="1.9" fill="var(--brand)" />
        <circle cx="16" cy="15" r="1.9" fill="var(--brand)" opacity="0.75" />
        <circle cx="21.4" cy="15" r="1.9" fill="var(--brand)" opacity="0.5" />
      </svg>
      <span className={cn("absolute grid place-items-center rounded-full bg-white p-[2px] shadow-card ring-2 ring-background", badge)}>
        <LogoMark className="size-full" title="" />
      </span>
      {online ? <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-mint ring-2 ring-background" /> : null}
    </span>
  );
}
