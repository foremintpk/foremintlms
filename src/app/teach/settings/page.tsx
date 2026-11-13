import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { AccountSettings } from "@/components/account/account-settings";
import { parseAccountTab } from "@/components/account/constants";
import { EmptyState } from "@/components/common/empty-state";
import { InstructorProfileForm } from "@/components/teaching/instructor-profile-form";
import { MeetingAccounts } from "@/components/teaching/meeting-accounts";
import { requireTeacher } from "@/lib/auth/guards";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQueryString } from "@/lib/list-params";
import { cn } from "@/lib/utils";
import { UserRound } from "lucide-react";

export const instant = false;
export const metadata = { title: "Settings" };

const SECTIONS = [
  { key: "account", label: "Account" },
  { key: "profile", label: "Instructor profile" },
  { key: "meetings", label: "Meeting accounts" },
] as const;

type Section = (typeof SECTIONS)[number]["key"];

export default async function TeachSettingsPage({ searchParams }: PageProps<"/teach/settings">) {
  const user = await requireTeacher("/teach/settings");
  const raw = await searchParams;
  const section: Section = SECTIONS.some((s) => s.key === raw.section) ? (raw.section as Section) : "account";

  type InstructorRow = {
    public_name: string;
    slug: string;
    headline: string | null;
    bio: string | null;
    avatar_url: string | null;
    expertise: string[];
    website_url: string | null;
    social_links: Record<string, string> | null;
    is_public: boolean;
    status: string;
  };
  let profile: InstructorRow | null = null;
  if (section === "profile") {
    const { data } = await createAdminClient()
      .from("teacher_profiles")
      .select("public_name, slug, headline, bio, avatar_url, expertise, website_url, social_links, is_public, status")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = (data as InstructorRow | null) ?? null;
  }

  return (
    <>
      <PageHeader title="Settings" description="Your account, the profile students see, and the meeting accounts used for live classes." />
      <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            href={`/teach/settings${buildQueryString({}, { section: s.key === "account" ? null : s.key })}`}
            aria-current={section === s.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              section === s.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {section === "account" ? (
        <AccountSettings user={user} defaultTab={parseAccountTab(raw.tab)} settingsPath="/teach/settings" />
      ) : section === "profile" ? (
        profile ? (
          <div className="max-w-3xl rounded-2xl border bg-card p-5 shadow-card sm:p-7">
            <InstructorProfileForm
              status={profile.status}
              siteUrl={appUrl()}
              initial={{
                public_name: profile.public_name,
                slug: profile.slug,
                headline: profile.headline ?? "",
                bio: profile.bio ?? "",
                avatar_url: profile.avatar_url ?? "",
                expertise: profile.expertise ?? [],
                website_url: profile.website_url ?? "",
                social_links: profile.social_links ?? {},
                is_public: profile.is_public,
              }}
            />
          </div>
        ) : (
          <EmptyState icon={UserRound} title="No instructor profile yet" description="An administrator sets up instructor profiles. Contact support if yours is missing." />
        )
      ) : (
        <div className="max-w-3xl">
          <MeetingAccounts userId={user.id} returnTo="/teach/settings?section=meetings" />
        </div>
      )}
    </>
  );
}
