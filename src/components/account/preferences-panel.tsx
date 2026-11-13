"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { updateNotificationPreferencesAction } from "./actions";
import { NOTIFICATION_CATEGORIES, type NotificationCategoryKey } from "./constants";

export type PreferenceMap = Record<NotificationCategoryKey, { email: boolean; inApp: boolean }>;

export function PreferencesPanel({ initial }: { initial: PreferenceMap }) {
  const [prefs, setPrefs] = useState(initial);
  const { run, pending } = useAction(updateNotificationPreferencesAction);
  const toggle = (key: NotificationCategoryKey, channel: "email" | "inApp", value: boolean) =>
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [channel]: value } }));

  return (
    <form
      className="grid max-w-3xl gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          preferences: NOTIFICATION_CATEGORIES.map((c) => ({
            category: c.key,
            email_enabled: prefs[c.key].email,
            in_app_enabled: c.key === "marketing" ? false : prefs[c.key].inApp,
          })),
        });
      }}
    >
      <p className="text-sm text-muted-foreground">
        Security alerts, password resets, receipts and failed payments are always emailed, whatever you choose here.
      </p>
      <div className="overflow-hidden rounded-xl border">
        <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid">
          <span>Topic</span>
          <span className="text-center">Email</span>
          <span className="text-center">In the app</span>
        </div>
        <ul className="divide-y">
          {NOTIFICATION_CATEGORIES.map((c) => (
            <li key={c.key} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] sm:items-center sm:gap-4">
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.description}</p>
              </div>
              <label className="flex items-center gap-2 text-sm sm:justify-center">
                <Switch checked={prefs[c.key].email} onCheckedChange={(v) => toggle(c.key, "email", v)} aria-label={`${c.label} emails`} />
                <span className="sm:sr-only">Email</span>
              </label>
              {c.key === "marketing" ? (
                <span className="text-xs text-muted-foreground sm:text-center">Email only</span>
              ) : (
                <label className="flex items-center gap-2 text-sm sm:justify-center">
                  <Switch checked={prefs[c.key].inApp} onCheckedChange={(v) => toggle(c.key, "inApp", v)} aria-label={`${c.label} in-app notifications`} />
                  <span className="sm:sr-only">In the app</span>
                </label>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button type="submit" disabled={pending} className="h-10">
          {pending ? (
            <>
              <Spinner className="size-4" /> Saving…
            </>
          ) : (
            "Save preferences"
          )}
        </Button>
      </div>
    </form>
  );
}
