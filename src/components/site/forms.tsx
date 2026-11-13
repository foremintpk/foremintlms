"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  enrollInFreeCourseAction,
  submitContactForm,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  type FormState,
} from "@/app/(site)/actions";
import { cn } from "@/lib/utils";
import { ctaClass } from "./primitives";

const initial: FormState = { status: "idle" };

function FieldMessage({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-destructive">
      {errors[0]}
    </p>
  );
}

/** Hidden field bots tend to fill in; real visitors never see it. */
function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

export function NewsletterForm({ source = "footer", tone = "default" }: { source?: string; tone?: "default" | "inverse" }) {
  const [state, action, pending] = useActionState(subscribeToNewsletter, initial);
  if (state.status === "success") {
    return (
      <p role="status" className={cn("flex items-start gap-2 text-sm", tone === "inverse" ? "text-white/90" : "text-foreground")}>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden />
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="relative" noValidate>
      <Honeypot />
      <input type="hidden" name="source" value={source} />
      <Label htmlFor={`newsletter-${source}`} className="sr-only">
        Email address
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`newsletter-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "error" ? `newsletter-${source}-error` : undefined}
          className={cn("h-11 rounded-xl", tone === "inverse" && "border-white/20 bg-white/10 text-white placeholder:text-white/50")}
        />
        <Button type="submit" disabled={pending} className={ctaClass(tone === "inverse" ? "inverse" : "primary", "shadow-none")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Subscribe
        </Button>
      </div>
      {state.status === "error" ? (
        <p id={`newsletter-${source}-error`} className={cn("mt-2 text-sm", tone === "inverse" ? "text-[#ffb4c0]" : "text-destructive")}>
          {state.fieldErrors?.email?.[0] ?? state.message}
        </p>
      ) : (
        <p className={cn("mt-2 text-xs", tone === "inverse" ? "text-white/60" : "text-muted-foreground")}>
          Occasional emails about new courses and guides. Unsubscribe any time.
        </p>
      )}
    </form>
  );
}

const TOPIC_OPTIONS = [
  { value: "general", label: "General question" },
  { value: "courses", label: "Courses and enrollment" },
  { value: "billing", label: "Billing" },
  { value: "business", label: "Business or team training" },
  { value: "instructor", label: "Teaching at Foremint Academy" },
];

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactForm, initial);
  const [topic, setTopic] = useState("general");
  if (state.status === "success") {
    return (
      <div role="status" className="rounded-2xl border bg-success-soft/60 p-6">
        <CheckCircle2 className="size-6 text-success" aria-hidden />
        <p className="mt-3 text-lg font-semibold">Message sent</p>
        <p className="mt-1 text-muted-foreground">{state.message}</p>
      </div>
    );
  }
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="relative grid gap-5" noValidate>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">Your name</Label>
          <Input id="contact-name" name="full_name" required autoComplete="name" className="mt-2 h-11" aria-invalid={Boolean(fe.full_name)} aria-describedby={fe.full_name ? "contact-name-error" : undefined} />
          <FieldMessage id="contact-name-error" errors={fe.full_name} />
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" required autoComplete="email" className="mt-2 h-11" aria-invalid={Boolean(fe.email)} aria-describedby={fe.email ? "contact-email-error" : undefined} />
          <FieldMessage id="contact-email-error" errors={fe.email} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-topic">Topic</Label>
          <input type="hidden" name="topic" value={topic} />
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger id="contact-topic" className="mt-2 h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPIC_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="contact-phone">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" className="mt-2 h-11" />
        </div>
      </div>
      <div>
        <Label htmlFor="contact-message">How can we help?</Label>
        <Textarea id="contact-message" name="message" required rows={6} maxLength={5000} className="mt-2" aria-invalid={Boolean(fe.message)} aria-describedby={fe.message ? "contact-message-error" : undefined} />
        <FieldMessage id="contact-message-error" errors={fe.message} />
      </div>
      {state.status === "error" && !Object.keys(fe).length ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          We use your details only to reply. See our{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
        <Button type="submit" disabled={pending} className={ctaClass("primary")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Send message
        </Button>
      </div>
    </form>
  );
}

export function EnrollFreeButton({ courseId, slug, label = "Enroll for free", className }: { courseId: string; slug: string; label?: string; className?: string }) {
  const [state, action, pending] = useActionState(enrollInFreeCourseAction, initial);
  return (
    <form action={action} className={cn("grid gap-2", className)}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="slug" value={slug} />
      <Button type="submit" disabled={pending} className={ctaClass("primary", "w-full")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? "Enrolling…" : label}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeFromNewsletter, initial);
  if (state.status === "success") {
    return (
      <p role="status" className="flex items-start gap-2 text-base">
        <CheckCircle2 className="mt-1 size-5 shrink-0 text-success" aria-hidden />
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={pending} className={ctaClass("primary", "w-fit")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Unsubscribe from the newsletter
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.fieldErrors?.token?.[0] ?? state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CertificateLookupForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const number = value.trim().toUpperCase().replace(/\s+/g, "");
        if (!/^FMA-\d{4}-[A-HJ-NP-Z2-9]{8}$/.test(number)) {
          setError("Certificate numbers look like FMA-2026-7K3Q9XPA.");
          return;
        }
        setError(null);
        router.push(`/certificates/verify/${number}`);
      }}
    >
      <Label htmlFor="certificate-number">Certificate number</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="certificate-number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="FMA-2026-7K3Q9XPA"
          autoComplete="off"
          spellCheck={false}
          className="h-11 font-mono uppercase"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "certificate-number-error" : undefined}
        />
        <Button type="submit" className={ctaClass("primary")}>
          Verify certificate
        </Button>
      </div>
      {error ? (
        <p id="certificate-number-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
