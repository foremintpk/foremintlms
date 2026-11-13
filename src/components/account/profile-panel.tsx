"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/common/file-upload";
import { FormField } from "@/components/auth/form-bits";
import { useAction } from "@/hooks/use-action";
import { initials } from "@/lib/format";
import { removeAvatarAction, updateAvatarAction, updateProfileAction } from "./actions";

export interface ProfileValues {
  email: string;
  fullName: string;
  displayName: string;
  headline: string;
  bio: string;
  timezone: string;
  avatarUrl: string | null;
}

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

export function ProfilePanel({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const zones = useMemo(() => {
    const list = timeZones();
    return list.includes(values.timezone) || values.timezone === "UTC" ? list : [values.timezone, ...list];
  }, [values.timezone]);
  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = useAction(updateProfileAction, { onSuccess: () => router.refresh() });
  const saveAvatar = useAction(updateAvatarAction, { onSuccess: () => router.refresh() });
  const removeAvatar = useAction(removeAvatarAction, {
    onSuccess: () => {
      set("avatarUrl", null);
      router.refresh();
    },
  });
  const errors = save.fieldErrors;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start" aria-labelledby="photo-heading">
        <Avatar className="size-20 ring-1 ring-border">
          {values.avatarUrl ? <AvatarImage src={values.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-brand-soft text-xl font-semibold text-primary">{initials(values.fullName || values.email)}</AvatarFallback>
        </Avatar>
        <div className="grid gap-3">
          <div>
            <h3 id="photo-heading" className="text-sm font-semibold">
              Profile photo
            </h3>
            <p className="text-sm text-muted-foreground">Shown to instructors and classmates. PNG, JPG or WebP, up to 5 MB.</p>
          </div>
          <FileUpload
            purpose="avatar"
            accept="image/png,image/jpeg,image/webp"
            label="Upload a photo"
            onUploaded={(file) => {
              if (file.publicUrl) {
                set("avatarUrl", file.publicUrl);
                void saveAvatar.run({ url: file.publicUrl });
              }
            }}
            className="max-w-md"
          />
          {values.avatarUrl ? (
            <Button type="button" variant="ghost" className="w-fit text-destructive hover:text-destructive" disabled={removeAvatar.pending} onClick={() => removeAvatar.run(undefined)}>
              Remove photo
            </Button>
          ) : null}
        </div>
      </section>

      <form
        className="grid max-w-2xl gap-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save.run({
            fullName: values.fullName,
            displayName: values.displayName,
            headline: values.headline,
            bio: values.bio,
            timezone: values.timezone,
          });
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="fullName" error={errors.fullName}>
            <Input id="fullName" value={values.fullName} onChange={(e) => set("fullName", e.target.value)} maxLength={120} autoComplete="name" required />
          </FormField>
          <FormField label="Display name" htmlFor="displayName" description="Optional — shown in discussions instead of your full name." error={errors.displayName}>
            <Input id="displayName" value={values.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} autoComplete="nickname" />
          </FormField>
        </div>
        <FormField label="Email" htmlFor="email" description="To change the email on your account, contact support.">
          <Input id="email" value={values.email} readOnly disabled />
        </FormField>
        <FormField label="Headline" htmlFor="headline" description="One line about you, e.g. “Shopify store owner in Lisbon”." error={errors.headline}>
          <Input id="headline" value={values.headline} onChange={(e) => set("headline", e.target.value)} maxLength={160} />
        </FormField>
        <FormField label="About you" htmlFor="bio" error={errors.bio}>
          <Textarea id="bio" value={values.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={4000} />
        </FormField>
        <FormField label="Time zone" htmlFor="timezone" description="Live classes and deadlines are shown in this time zone in emails." error={errors.timezone}>
          <Select value={values.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger id="timezone" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="UTC">UTC</SelectItem>
              {zones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div>
          <Button type="submit" disabled={save.pending} className="h-10">
            {save.pending ? (
              <>
                <Spinner className="size-4" /> Saving…
              </>
            ) : (
              "Save profile"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
