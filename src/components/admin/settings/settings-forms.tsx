"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import { KNOWN_EXTENSIONS, SOCIAL_NETWORKS, SETTINGS_SECTION_LABELS, type SettingsSection } from "@/lib/services/admin/settings-schema";
import { saveSettings } from "@/app/admin/settings/actions";

type Values = Record<string, unknown>;

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

const DESCRIPTIONS: Record<SettingsSection, string> = {
  brand: "Name, tagline and colours used on the website, emails, certificates and receipts.",
  contact: "How customers reach you. Shown on the contact page, footer and in emails.",
  legal: "Filled into the legal pages and receipts. Leave blank anything that doesn't apply — never enter placeholder details.",
  billing: "Defaults for pricing plans and receipts.",
  security: "Account protection for administrators and sign-in options.",
  messaging: "Who students may start private conversations with.",
  uploads: "Size and type limits for uploaded files. Checked on the server for every upload.",
  learning: "Reminder timing for live classes and expiring access.",
  analytics: "Loaded only for visitors who accept analytics cookies.",
};

const REMINDER_PRESETS = [
  { value: 10080, label: "1 week before" },
  { value: 1440, label: "24 hours before" },
  { value: 180, label: "3 hours before" },
  { value: 60, label: "1 hour before" },
  { value: 30, label: "30 minutes before" },
  { value: 15, label: "15 minutes before" },
];

function SectionCard({ section, children, build }: { section: SettingsSection; children: (errors: Record<string, string[]>) => React.ReactNode; build: () => Values }) {
  const router = useRouter();
  const { run, pending, fieldErrors } = useAction(saveSettings, { onSuccess: () => router.refresh() });
  return (
    <Card id={section} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{SETTINGS_SECTION_LABELS[section]}</CardTitle>
        <CardDescription>{DESCRIPTIONS[section]}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run({ section, values: build() });
          }}
        >
          {children(fieldErrors)}
          <Button type="submit" className="mt-6" disabled={pending}>
            {pending ? "Saving…" : `Save ${SETTINGS_SECTION_LABELS[section].toLowerCase()} settings`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ColorField({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-lg border bg-transparent p-1"
        />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-32 font-mono" maxLength={7} />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function SettingsForms({ initial }: { initial: Record<SettingsSection, Values> }) {
  const b = initial.brand;
  const [brand, setBrand] = useState({
    name: str(b.name, "Foremint Academy"),
    tagline: str(b.tagline),
    primary_color: str(b.primary_color, "#5B3DF5"),
    accent_color: str(b.accent_color, "#3DDC97"),
    logo_url: str(b.logo_url),
  });
  const c = initial.contact;
  const socialInit = (c.social_links as Record<string, string> | undefined) ?? {};
  const [contact, setContact] = useState({
    support_email: str(c.support_email),
    phone: str(c.phone),
    social_links: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, str(socialInit[n])])) as Record<string, string>,
  });
  const l = initial.legal;
  const [legal, setLegal] = useState({
    entity_name: str(l.entity_name),
    business_address: str(l.business_address),
    jurisdiction: str(l.jurisdiction),
    registration_number: str(l.registration_number),
    tax_id: str(l.tax_id),
  });
  const bl = initial.billing;
  const [billing, setBilling] = useState({
    default_currency: str(bl.default_currency, "usd"),
    default_grace_period_days: num(bl.default_grace_period_days, 3),
    send_foremint_receipts: bool(bl.send_foremint_receipts, false),
    invoice_footer: str(bl.invoice_footer),
  });
  const s = initial.security;
  const [security, setSecurity] = useState({
    require_admin_mfa: bool(s.require_admin_mfa, true),
    allow_google_login: bool(s.allow_google_login, false),
  });
  const [messaging, setMessaging] = useState({
    students_can_message_any_teacher: bool(initial.messaging.students_can_message_any_teacher, false),
  });
  const u = initial.uploads;
  const limits = (u.limits_mb as Record<string, number> | undefined) ?? {};
  const exts = (u.allowed_extensions as Record<string, string[]> | undefined) ?? {};
  const [uploads, setUploads] = useState({
    limits_mb: {
      course_content: limits.course_content ?? 200,
      submission: limits.submission ?? 25,
      attachment: limits.attachment ?? 10,
      image: limits.image ?? 5,
    },
    allowed_extensions: {
      course_content: exts.course_content ?? ["pdf"],
      submission: exts.submission ?? ["pdf"],
      attachment: exts.attachment ?? ["pdf"],
    },
  });
  const le = initial.learning;
  const [learning, setLearning] = useState({
    live_reminder_offsets_minutes: (le.live_reminder_offsets_minutes as number[] | undefined) ?? [1440, 60],
    access_expiry_reminder_days: num(le.access_expiry_reminder_days, 7),
  });
  const a = initial.analytics;
  const [analytics, setAnalytics] = useState({ ga_measurement_id: str(a.ga_measurement_id), plausible_domain: str(a.plausible_domain) });

  const nav = Object.keys(SETTINGS_SECTION_LABELS) as SettingsSection[];

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:h-fit">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((key) => (
            <li key={key}>
              <a href={`#${key}`} className="block rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground">
                {SETTINGS_SECTION_LABELS[key]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid min-w-0 gap-6">
        <SectionCard section="brand" build={() => brand}>
          {(e) => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="brand-name">Brand name</FieldLabel>
                  <Input id="brand-name" value={brand.name} onChange={(ev) => setBrand({ ...brand, name: ev.target.value })} required maxLength={80} />
                  <FieldError>{e.name?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="brand-tagline">Tagline</FieldLabel>
                  <Input id="brand-tagline" value={brand.tagline} onChange={(ev) => setBrand({ ...brand, tagline: ev.target.value })} maxLength={160} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField id="brand-primary" label="Primary colour" value={brand.primary_color} onChange={(v) => setBrand({ ...brand, primary_color: v })} error={e.primary_color?.[0]} />
                <ColorField id="brand-accent" label="Accent colour" value={brand.accent_color} onChange={(v) => setBrand({ ...brand, accent_color: v })} error={e.accent_color?.[0]} />
              </div>
              <FieldDescription>The website theme uses its own design tokens; these colours apply to emails, certificates and receipts.</FieldDescription>
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <FieldDescription>Optional. Leave empty to use the built-in Foremint mark.</FieldDescription>
                <ImageField value={brand.logo_url} onChange={(v) => setBrand({ ...brand, logo_url: v })} aspect="aspect-[3/1]" label="Upload a logo" />
                <FieldError>{e.logo_url?.[0]}</FieldError>
              </Field>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="contact" build={() => contact}>
          {(e) => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="contact-email">Support email</FieldLabel>
                  <Input id="contact-email" type="email" value={contact.support_email} onChange={(ev) => setContact({ ...contact, support_email: ev.target.value })} />
                  <FieldError>{e.support_email?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
                  <Input id="contact-phone" value={contact.phone} onChange={(ev) => setContact({ ...contact, phone: ev.target.value })} maxLength={40} />
                </Field>
              </div>
              <FieldSet>
                <FieldLegend variant="label">Social profiles</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SOCIAL_NETWORKS.map((n) => (
                    <Field key={n}>
                      <FieldLabel htmlFor={`social-${n}`} className="capitalize">
                        {n === "x" ? "X" : n}
                      </FieldLabel>
                      <Input
                        id={`social-${n}`}
                        placeholder="https://"
                        value={contact.social_links[n] ?? ""}
                        onChange={(ev) => setContact({ ...contact, social_links: { ...contact.social_links, [n]: ev.target.value } })}
                      />
                      <FieldError>{e[`social_links.${n}`]?.[0]}</FieldError>
                    </Field>
                  ))}
                </div>
              </FieldSet>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="legal" build={() => legal}>
          {() => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="legal-entity">Legal entity name</FieldLabel>
                  <Input id="legal-entity" value={legal.entity_name} onChange={(ev) => setLegal({ ...legal, entity_name: ev.target.value })} maxLength={200} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="legal-jurisdiction">Governing law / jurisdiction</FieldLabel>
                  <Input id="legal-jurisdiction" value={legal.jurisdiction} onChange={(ev) => setLegal({ ...legal, jurisdiction: ev.target.value })} placeholder="e.g. England and Wales" maxLength={200} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="legal-address">Registered address</FieldLabel>
                <Textarea id="legal-address" rows={3} value={legal.business_address} onChange={(ev) => setLegal({ ...legal, business_address: ev.target.value })} maxLength={500} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="legal-reg">Company registration number</FieldLabel>
                  <Input id="legal-reg" value={legal.registration_number} onChange={(ev) => setLegal({ ...legal, registration_number: ev.target.value })} maxLength={80} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="legal-tax">Tax / VAT number</FieldLabel>
                  <Input id="legal-tax" value={legal.tax_id} onChange={(ev) => setLegal({ ...legal, tax_id: ev.target.value })} maxLength={80} />
                  <FieldDescription>Only if you are registered. Printed on receipts, never on public pages.</FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="billing" build={() => billing}>
          {(e) => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="bill-currency">Default currency</FieldLabel>
                  <Input id="bill-currency" value={billing.default_currency} onChange={(ev) => setBilling({ ...billing, default_currency: ev.target.value.toLowerCase() })} maxLength={3} className="w-24 uppercase" />
                  <FieldDescription>3-letter code. Also used for revenue dashboards.</FieldDescription>
                  <FieldError>{e.default_currency?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="bill-grace">Grace period after a missed renewal (days)</FieldLabel>
                  <Input
                    id="bill-grace"
                    type="number"
                    min={0}
                    max={60}
                    value={billing.default_grace_period_days}
                    onChange={(ev) => setBilling({ ...billing, default_grace_period_days: Number(ev.target.value) })}
                    className="w-24"
                  />
                  <FieldError>{e.default_grace_period_days?.[0]}</FieldError>
                </Field>
              </div>
              <Field orientation="horizontal">
                <Switch id="bill-receipts" checked={billing.send_foremint_receipts} onCheckedChange={(v) => setBilling({ ...billing, send_foremint_receipts: v })} />
                <FieldContent>
                  <FieldLabel htmlFor="bill-receipts">Email a Foremint receipt too</FieldLabel>
                  <FieldDescription>Whop already emails its own receipt. Turn this on only if customers need a second, Foremint-branded copy.</FieldDescription>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="bill-footer">Receipt footer</FieldLabel>
                <Textarea id="bill-footer" rows={2} value={billing.invoice_footer} onChange={(ev) => setBilling({ ...billing, invoice_footer: ev.target.value })} maxLength={600} />
              </Field>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="security" build={() => security}>
          {() => (
            <FieldGroup>
              <Field orientation="horizontal">
                <Switch id="sec-mfa" checked={security.require_admin_mfa} onCheckedChange={(v) => setSecurity({ ...security, require_admin_mfa: v })} />
                <FieldContent>
                  <FieldLabel htmlFor="sec-mfa">Require an authenticator app for administrators</FieldLabel>
                  <FieldDescription>Administrators must verify a 6-digit code before using the admin workspace. Enforced in the database as well as the app.</FieldDescription>
                </FieldContent>
              </Field>
              {!security.require_admin_mfa ? (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Turning this off means a stolen admin password alone gives full access to payments, student data and settings. Keep it on in production.
                </p>
              ) : null}
              <Field orientation="horizontal">
                <Switch id="sec-google" checked={security.allow_google_login} onCheckedChange={(v) => setSecurity({ ...security, allow_google_login: v })} />
                <FieldContent>
                  <FieldLabel htmlFor="sec-google">Show “Continue with Google”</FieldLabel>
                  <FieldDescription>Requires the Google provider to be enabled in Supabase Authentication.</FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="messaging" build={() => messaging}>
          {() => (
            <Field orientation="horizontal">
              <Switch id="msg-any" checked={messaging.students_can_message_any_teacher} onCheckedChange={(v) => setMessaging({ students_can_message_any_teacher: v })} />
              <FieldContent>
                <FieldLabel htmlFor="msg-any">Let students message any approved instructor</FieldLabel>
                <FieldDescription>When off, students can only message instructors of courses they’re enrolled in.</FieldDescription>
              </FieldContent>
            </Field>
          )}
        </SectionCard>

        <SectionCard section="uploads" build={() => uploads}>
          {(e) => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-4">
                {(
                  [
                    ["course_content", "Course files", 500],
                    ["submission", "Assignment files", 200],
                    ["attachment", "Message & ticket files", 50],
                    ["image", "Images", 20],
                  ] as const
                ).map(([key, label, max]) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`limit-${key}`}>{label} (MB)</FieldLabel>
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      min={1}
                      max={max}
                      value={uploads.limits_mb[key]}
                      onChange={(ev) => setUploads({ ...uploads, limits_mb: { ...uploads.limits_mb, [key]: Number(ev.target.value) } })}
                    />
                    <FieldError>{e[`limits_mb.${key}`]?.[0]}</FieldError>
                  </Field>
                ))}
              </div>
              <FieldDescription>Your Supabase plan also has a global upload limit (50 MB on the free plan); the lower limit wins.</FieldDescription>
              {(
                [
                  ["course_content", "Course files"],
                  ["submission", "Assignment submissions"],
                  ["attachment", "Message and ticket attachments"],
                ] as const
              ).map(([key, label]) => (
                <FieldSet key={key}>
                  <FieldLegend variant="label">{label}: allowed types</FieldLegend>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {KNOWN_EXTENSIONS.map((ext) => {
                      const list = uploads.allowed_extensions[key];
                      return (
                        <label key={ext} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={list.includes(ext)}
                            onCheckedChange={(v) =>
                              setUploads({
                                ...uploads,
                                allowed_extensions: {
                                  ...uploads.allowed_extensions,
                                  [key]: v ? [...list, ext] : list.filter((x) => x !== ext),
                                },
                              })
                            }
                          />
                          .{ext}
                        </label>
                      );
                    })}
                  </div>
                  <FieldError>{e[`allowed_extensions.${key}`]?.[0]}</FieldError>
                </FieldSet>
              ))}
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="learning" build={() => learning}>
          {(e) => (
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Live class reminders (up to three)</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {REMINDER_PRESETS.map((p) => {
                    const on = learning.live_reminder_offsets_minutes.includes(p.value);
                    return (
                      <label key={p.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={on}
                          disabled={!on && learning.live_reminder_offsets_minutes.length >= 3}
                          onCheckedChange={(v) =>
                            setLearning({
                              ...learning,
                              live_reminder_offsets_minutes: v
                                ? [...learning.live_reminder_offsets_minutes, p.value]
                                : learning.live_reminder_offsets_minutes.filter((x) => x !== p.value),
                            })
                          }
                        />
                        {p.label}
                      </label>
                    );
                  })}
                </div>
                <FieldError>{e.live_reminder_offsets_minutes?.[0]}</FieldError>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="learn-expiry">Remind learners before fixed-term access ends (days)</FieldLabel>
                <Input
                  id="learn-expiry"
                  type="number"
                  min={1}
                  max={60}
                  className="w-24"
                  value={learning.access_expiry_reminder_days}
                  onChange={(ev) => setLearning({ ...learning, access_expiry_reminder_days: Number(ev.target.value) })}
                />
                <FieldError>{e.access_expiry_reminder_days?.[0]}</FieldError>
              </Field>
            </FieldGroup>
          )}
        </SectionCard>

        <SectionCard section="analytics" build={() => analytics}>
          {(e) => (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ga-id">Google Analytics 4 ID</FieldLabel>
                  <Input id="ga-id" placeholder="G-XXXXXXX" value={analytics.ga_measurement_id} onChange={(ev) => setAnalytics({ ...analytics, ga_measurement_id: ev.target.value.toUpperCase() })} />
                  <FieldError>{e.ga_measurement_id?.[0]}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="plausible">Plausible domain</FieldLabel>
                  <Input id="plausible" placeholder="academy.example.com" value={analytics.plausible_domain} onChange={(ev) => setAnalytics({ ...analytics, plausible_domain: ev.target.value })} />
                  <FieldError>{e.plausible_domain?.[0]}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
