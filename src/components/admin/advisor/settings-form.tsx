"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import type { AdvisorConfig } from "@/lib/domain/advisor";
import { saveAdvisorSettingsAction } from "@/app/admin/advisor/actions";

export function AdvisorSettingsForm({ config, retentionDays }: { config: AdvisorConfig; retentionDays: number }) {
  const router = useRouter();
  const [v, setV] = useState<AdvisorConfig>(config);
  const [retention, setRetention] = useState(String(retentionDays));
  const { run, pending, fieldErrors } = useAction(saveAdvisorSettingsAction, { onSuccess: () => router.refresh() });
  const set = <K extends keyof AdvisorConfig>(key: K, value: AdvisorConfig[K]) => setV((c) => ({ ...c, [key]: value }));
  const configError = fieldErrors.config?.[0];

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ config: { ...v, quick_replies: v.quick_replies.filter((q) => q.trim()) }, retention_days: Number(retention) || 90 });
      }}
    >
      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">When off, the launcher disappears from every public page.</p>
          </div>
          <Switch checked={v.enabled} onCheckedChange={(x) => set("enabled", x)} aria-label="Show the course advisor on the website" />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold">Messages</h2>
        <FieldGroup className="mt-4">
          <Field>
            <FieldLabel htmlFor="a-greeting">Greeting</FieldLabel>
            <Input id="a-greeting" value={v.greeting} onChange={(e) => set("greeting", e.target.value)} maxLength={200} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="a-intro">Introduction</FieldLabel>
            <Textarea id="a-intro" value={v.intro} onChange={(e) => set("intro", e.target.value)} maxLength={600} rows={3} />
            <FieldDescription>Shown under the greeting when the chat opens.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="a-fallback">When no rule matches</FieldLabel>
            <Textarea id="a-fallback" value={v.fallback} onChange={(e) => set("fallback", e.target.value)} maxLength={400} rows={2} required />
            <FieldDescription>Followed by guided options (the answers of the “not sure” intent when it exists).</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="a-closing">Closing message</FieldLabel>
            <Input id="a-closing" value={v.closing} onChange={(e) => set("closing", e.target.value)} maxLength={300} />
            <FieldDescription>Used when a visitor says thanks or goodbye.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="a-privacy">Privacy notice</FieldLabel>
            <Textarea id="a-privacy" value={v.privacy_notice} onChange={(e) => set("privacy_notice", e.target.value)} maxLength={300} rows={2} />
            <FieldDescription>Small print under the message box. Say what is logged and that the assistant is rule-based.</FieldDescription>
          </Field>
        </FieldGroup>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Quick replies</h2>
            <p className="mt-1 text-sm text-muted-foreground">Buttons on the welcome message. Each one is sent as if the visitor typed it, so it should match an intent.</p>
          </div>
          <Switch checked={v.show_quick_replies} onCheckedChange={(x) => set("show_quick_replies", x)} aria-label="Show quick replies" />
        </div>
        <div className="mt-4 grid gap-2">
          {v.quick_replies.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input value={q} onChange={(e) => set("quick_replies", v.quick_replies.map((x, j) => (j === i ? e.target.value : x)))} maxLength={120} aria-label={`Quick reply ${i + 1}`} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={i === 0}
                onClick={() => {
                  const next = [...v.quick_replies];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set("quick_replies", next);
                }}
                aria-label={`Move quick reply ${i + 1} up`}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={i === v.quick_replies.length - 1}
                onClick={() => {
                  const next = [...v.quick_replies];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  set("quick_replies", next);
                }}
                aria-label={`Move quick reply ${i + 1} down`}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => set("quick_replies", v.quick_replies.filter((_, j) => j !== i))} aria-label={`Remove quick reply ${i + 1}`}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {v.quick_replies.length < 12 ? (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => set("quick_replies", [...v.quick_replies, ""])}>
              <Plus className="size-4" /> Add quick reply
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold">Limits and privacy</h2>
        <FieldGroup className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="a-max">Messages per conversation</FieldLabel>
              <Input id="a-max" type="number" min={5} max={500} value={v.max_messages} onChange={(e) => set("max_messages", Number(e.target.value))} />
              <FieldDescription>Stops runaway or automated chats.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="a-ttl">Session expires after (minutes idle)</FieldLabel>
              <Input id="a-ttl" type="number" min={5} max={1440} value={v.session_ttl_minutes} onChange={(e) => set("session_ttl_minutes", Number(e.target.value))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="a-retention">Keep conversation logs (days)</FieldLabel>
              <Input id="a-retention" type="number" min={7} max={730} value={retention} onChange={(e) => setRetention(e.target.value)} />
              <FieldDescription>Older logs are deleted daily.</FieldDescription>
              {fieldErrors.retention_days?.[0] ? <FieldError>{fieldErrors.retention_days[0]}</FieldError> : null}
            </Field>
          </div>
        </FieldGroup>
      </section>

      {configError ? <p className="text-sm text-destructive">Check the messages and limits: {configError}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save advisor settings"}
        </Button>
      </div>
    </form>
  );
}
