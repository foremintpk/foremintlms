"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAction, type ClientActionResult } from "@/hooks/use-action";
import { scheduleLiveSessionAction, updateLiveSessionAction } from "@/lib/services/live/actions";
import type { ProviderAvailability } from "@/lib/services/live/types";
import { cn } from "@/lib/utils";

export type { ProviderAvailability };

export interface SessionFormValues {
  sessionId?: string;
  courseId: string;
  title: string;
  description: string;
  provider: "zoom" | "google_meet" | "external";
  externalUrl: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  announcement: string;
}

const DURATIONS = [30, 45, 60, 90, 120, 180];

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

const PROVIDER_COPY: Record<"zoom" | "google_meet" | "external", { title: string; body: string }> = {
  zoom: { title: "Zoom", body: "Creates a Zoom meeting on your connected account." },
  google_meet: { title: "Google Meet", body: "Creates a Meet link on your connected Google account." },
  external: { title: "External link", body: "Use any meeting link you already have." },
};

export function SessionFormDialog({
  mode,
  courses,
  availability,
  initial,
  settingsHref,
  basePath,
  trigger,
}: {
  mode: "create" | "edit";
  courses: { id: string; title: string }[];
  availability: Record<"zoom" | "google_meet", ProviderAvailability>;
  initial: SessionFormValues;
  settingsHref: string;
  basePath: "/teach/live" | "/admin/live";
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SessionFormValues>(initial);
  const [notifyStudents, setNotifyStudents] = useState(true);
  const zones = useMemo(() => (open ? timeZones() : [initial.timezone]), [open, initial.timezone]);
  const set = <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const action = (mode === "create" ? scheduleLiveSessionAction : updateLiveSessionAction) as (
    input: unknown,
  ) => Promise<ClientActionResult<{ id: string }>>;
  const { run, pending, fieldErrors } = useAction(action, {
    onSuccess: (data) => {
      setOpen(false);
      if (mode === "create") router.push(`${basePath}/${data.id}`);
    },
  });

  const err = (key: string) => (fieldErrors[key]?.length ? [{ message: fieldErrors[key][0] }] : undefined);
  const providerUnavailable = (p: "zoom" | "google_meet") => availability[p] !== "connected";
  const customDuration = !DURATIONS.includes(values.durationMinutes);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValues(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Schedule a live class" : "Edit live class"}</DialogTitle>
          <DialogDescription>
            Students with access to the course are invited and see the time in their own time zone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ ...values, sessionId: values.sessionId, notifyStudents });
          }}
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="live-course">Course</FieldLabel>
              <Select value={values.courseId} onValueChange={(v) => set("courseId", v)} disabled={mode === "edit"}>
                <SelectTrigger id="live-course" aria-invalid={Boolean(err("courseId"))}>
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={err("courseId")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="live-title">Title</FieldLabel>
              <Input id="live-title" value={values.title} maxLength={200} onChange={(e) => set("title", e.target.value)} placeholder="Weekly Q&A: product research" aria-invalid={Boolean(err("title"))} />
              <FieldError errors={err("title")} />
            </Field>

            <Field>
              <FieldLabel htmlFor="live-description">Description</FieldLabel>
              <Textarea id="live-description" rows={3} maxLength={4000} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="What you'll cover and how to prepare" />
            </Field>

            <Field>
              <FieldLabel>Where it happens</FieldLabel>
              <RadioGroup
                value={values.provider}
                onValueChange={(v) => set("provider", v as SessionFormValues["provider"])}
                className="grid gap-2 sm:grid-cols-3"
              >
                {(["zoom", "google_meet", "external"] as const).map((p) => {
                  const disabled = p !== "external" && providerUnavailable(p) && values.provider !== p;
                  return (
                    <label
                      key={p}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-soft/60",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <RadioGroupItem value={p} disabled={disabled} />
                        {PROVIDER_COPY[p].title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p === "external"
                          ? PROVIDER_COPY[p].body
                          : availability[p] === "connected"
                            ? PROVIDER_COPY[p].body
                            : availability[p] === "not_configured"
                              ? "Not set up on this platform yet."
                              : availability[p] === "needs_reconnect"
                                ? "Reconnect your account in settings."
                                : "Connect your account in settings first."}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
              {(providerUnavailable("zoom") || providerUnavailable("google_meet")) && (
                <FieldDescription>
                  <Link href={settingsHref} className="font-medium text-primary hover:underline">
                    Manage meeting accounts
                  </Link>
                </FieldDescription>
              )}
            </Field>

            {values.provider === "external" ? (
              <Field>
                <FieldLabel htmlFor="live-url">Meeting link</FieldLabel>
                <Input id="live-url" type="url" inputMode="url" value={values.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} placeholder="https://" aria-invalid={Boolean(err("externalUrl"))} />
                <FieldDescription>Shared only with students who have access, from 15 minutes before the start.</FieldDescription>
                <FieldError errors={err("externalUrl")} />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="live-date">Date</FieldLabel>
                <Input id="live-date" type="date" value={values.date} onChange={(e) => set("date", e.target.value)} aria-invalid={Boolean(err("date"))} />
                <FieldError errors={err("date")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="live-time">Start time</FieldLabel>
                <Input id="live-time" type="time" value={values.time} onChange={(e) => set("time", e.target.value)} aria-invalid={Boolean(err("time"))} />
                <FieldError errors={err("time")} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="live-tz">Time zone</FieldLabel>
                <select
                  id="live-tz"
                  value={values.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <FieldError errors={err("timezone")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="live-duration">Duration</FieldLabel>
                <div className="flex gap-2">
                  <Select
                    value={customDuration ? "custom" : String(values.durationMinutes)}
                    onValueChange={(v) => set("durationMinutes", v === "custom" ? values.durationMinutes || 75 : Number(v))}
                  >
                    <SelectTrigger id="live-duration" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d < 60 ? `${d} minutes` : d % 60 === 0 ? `${d / 60} hour${d === 60 ? "" : "s"}` : `${Math.floor(d / 60)}h ${d % 60}m`}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {customDuration ? (
                    <Input
                      type="number"
                      min={5}
                      max={600}
                      className="w-24"
                      aria-label="Duration in minutes"
                      value={values.durationMinutes}
                      onChange={(e) => set("durationMinutes", Number(e.target.value))}
                    />
                  ) : null}
                </div>
                <FieldError errors={err("durationMinutes")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="live-announcement">Announcement</FieldLabel>
              <Textarea id="live-announcement" rows={2} maxLength={2000} value={values.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="Optional note shown with the class, e.g. what to bring" />
            </Field>

            <Field orientation="horizontal">
              <Checkbox id="live-notify" checked={notifyStudents} onCheckedChange={(v) => setNotifyStudents(v === true)} />
              <FieldLabel htmlFor="live-notify" className="font-normal">
                {mode === "create" ? "Email invited students" : "Email students if the time or link changes"}
              </FieldLabel>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !values.courseId}>
              {pending ? "Saving…" : mode === "create" ? "Schedule class" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
