"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, CalendarClock, Check, CircleUserRound, FileText, Infinity as InfinityIcon, Layers, Link2, ListChecks, Repeat, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import {
  ACCESS_DAY_PRESETS,
  BILLING_INTERVAL_PRESETS,
  INVOICE_CURRENCIES,
  billingIntervalLabel,
  formatMinor,
  intervalNoun,
  parseAmountToMinor,
} from "@/lib/domain/invoicing";
import { invoiceFormSchema, type InvoiceFormInput } from "@/lib/validation/invoicing";
import { saveCustomInvoice } from "@/app/admin/billing/actions";
import type { BuilderCourse } from "@/lib/services/invoicing/queries";

export interface BuilderCompany {
  id: string;
  name: string;
  primary_contact_email: string;
}

const STEPS = [
  { key: "customer", label: "Customer", icon: CircleUserRound },
  { key: "description", label: "Description", icon: ListChecks },
  { key: "courses", label: "Courses", icon: Layers },
  { key: "payment", label: "Payment & access", icon: CalendarClock },
] as const;

const FIELD_STEP: Record<string, (typeof STEPS)[number]["key"]> = {
  customerName: "customer",
  customerEmail: "customer",
  customerPhone: "customer",
  companyName: "customer",
  existingCompanyId: "customer",
  companyDescription: "customer",
  companyServices: "customer",
  internalNotes: "customer",
  invoiceDescription: "description",
  customerReference: "description",
  internalReference: "description",
  courseIds: "courses",
  amount: "payment",
  upfrontFee: "payment",
  accessDurationDays: "payment",
  accessEndDate: "payment",
  billingIntervalDays: "payment",
  billingCycles: "payment",
  dueDate: "payment",
  linkExpiryDate: "payment",
};

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

function fmtDate(d: Date | null) {
  return d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d) : "—";
}

type AccessChoice = `${number}` | "custom" | "lifetime" | "until_date";

export function InvoiceBuilder({
  courses,
  categories,
  companies,
  initial,
  draftId,
  revisionOf,
  revisionNumber,
  defaults,
  whopReady,
}: {
  courses: BuilderCourse[];
  categories: { id: string; name: string }[];
  companies: BuilderCompany[];
  initial: InvoiceFormInput | null;
  draftId: string | null;
  revisionOf: string | null;
  revisionNumber: string | null;
  defaults: { currency: string; dueDays: number; graceDays: number; allowLifetime: boolean; collectionMethod: "payment_link" | "whop_invoice" };
  whopReady: boolean;
}) {
  const router = useRouter();
  const published = useMemo(() => courses.filter((c) => c.status === "published"), [courses]);

  const [v, setV] = useState<InvoiceFormInput>(
    () =>
      initial ?? {
        invoiceType: "individual",
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        companyMode: "new",
        existingCompanyId: null,
        companyName: "",
        companyDescription: "",
        companyServices: "",
        internalNotes: "",
        invoiceDescription: "",
        customerReference: "",
        internalReference: "",
        courseSelectionMode: "selected",
        courseIds: [],
        currency: defaults.currency,
        amount: "",
        billingType: "one_time",
        collectionMethod: defaults.collectionMethod,
        accessMode: "days",
        accessDurationDays: 90,
        accessEndDate: null,
        billingIntervalDays: 30,
        billingCycles: null,
        upfrontFee: "",
        gracePeriodDays: defaults.graceDays,
        seatLimit: null,
        allowContactInvites: true,
        dueDate: defaults.dueDays ? addDays(defaults.dueDays).toISOString().slice(0, 10) : null,
        linkExpiryDate: null,
      },
  );
  const set = <K extends keyof InvoiceFormInput>(key: K, value: InvoiceFormInput[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const [accessChoice, setAccessChoice] = useState<AccessChoice>(() => {
    if (initial?.accessMode === "lifetime") return "lifetime";
    if (initial?.accessMode === "until_date") return "until_date";
    const d = initial?.accessDurationDays ?? 90;
    return (ACCESS_DAY_PRESETS as readonly number[]).includes(Number(d)) ? (String(d) as AccessChoice) : "custom";
  });
  const [intervalChoice, setIntervalChoice] = useState<string>(() => {
    const d = initial?.billingIntervalDays ?? 30;
    return BILLING_INTERVAL_PRESETS.some((p) => p.days === Number(d)) ? String(d) : "custom";
  });

  const [stage, setStage] = useState<"edit" | "review">("edit");
  const [confirmed, setConfirmed] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const [courseQuery, setCourseQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { run, pending, fieldErrors } = useAction(saveCustomInvoice, {
    silent: false,
    onSuccess: (data) => router.push(`/admin/billing/invoices/${data.id}`),
  });
  const errors = { ...localErrors, ...fieldErrors };
  const err = (key: string) => (errors[key]?.length ? <FieldError>{errors[key][0]}</FieldError> : null);

  // ---- Derived summary ----------------------------------------------------
  const selectedCourses = useMemo(() => {
    if (v.courseSelectionMode === "selected") return published.filter((c) => (v.courseIds ?? []).includes(c.id));
    return published;
  }, [v.courseSelectionMode, v.courseIds, published]);
  const amountMinor = parseAmountToMinor(v.amount ?? "", v.currency ?? "usd");
  const feeMinor = v.billingType === "recurring" && v.upfrontFee ? parseAmountToMinor(v.upfrontFee, v.currency ?? "usd") : 0;
  const money = (m: number | null) => (m === null ? "—" : formatMinor(m, v.currency ?? "usd"));
  const recurring = v.billingType === "recurring";
  const viaLink = (v.collectionMethod ?? "payment_link") === "payment_link";
  const interval = Number(v.billingIntervalDays) || 30;

  const accessLabel = recurring
    ? v.billingCycles
      ? `${v.billingCycles} payments · ${Number(v.billingCycles) * interval} days`
      : "While the subscription is active"
    : v.accessMode === "lifetime"
      ? "Lifetime access"
      : v.accessMode === "until_date"
        ? `Until ${fmtDate(v.accessEndDate ? new Date(`${v.accessEndDate}T00:00:00Z`) : null)}`
        : `${v.accessDurationDays ?? "—"} days from payment`;
  const estimatedExpiry = recurring
    ? v.billingCycles
      ? addDays(Number(v.billingCycles) * interval)
      : null
    : v.accessMode === "days" && v.accessDurationDays
      ? addDays(Number(v.accessDurationDays))
      : v.accessMode === "until_date" && v.accessEndDate
        ? new Date(`${v.accessEndDate}T00:00:00Z`)
        : null;
  const customerLabel = v.invoiceType === "company" ? (v.companyMode === "existing" ? companies.find((c) => c.id === v.existingCompanyId)?.name : v.companyName) || "New company" : v.customerName || "New customer";

  // ---- Courses ------------------------------------------------------------
  const visibleCourses = courses.filter(
    (c) =>
      (categoryFilter === "all" || c.categoryId === categoryFilter) &&
      (!courseQuery.trim() || `${c.title} ${c.category ?? ""} ${c.instructor ?? ""}`.toLowerCase().includes(courseQuery.trim().toLowerCase())),
  );
  const toggleCourse = (id: string, on: boolean) => {
    const current = new Set(v.courseIds ?? []);
    if (on) current.add(id);
    else current.delete(id);
    set("courseIds", [...current]);
  };

  // ---- Submit ---------------------------------------------------------------
  const validate = (): boolean => {
    const parsed = invoiceFormSchema.safeParse(v);
    if (parsed.success) {
      setLocalErrors({});
      return true;
    }
    const map: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (map[String(issue.path[0] ?? "_")] ??= []).push(issue.message);
    setLocalErrors(map);
    const first = Object.keys(map)[0];
    const step = first ? FIELD_STEP[first] : null;
    if (step) document.getElementById(`section-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return false;
  };

  const goReview = () => {
    if (!validate()) return;
    setConfirmed(false);
    setStage("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveDraft = () => {
    if (!validate()) return;
    void run({ form: v, intent: "draft", draftId, revisionOf });
  };

  const generate = () => {
    if (!confirmed) return;
    void run({ form: v, intent: "generate", draftId, revisionOf, termsConfirmed: true });
  };

  const summary = (
    <aside className="lg:sticky lg:top-20" aria-label="Invoice summary">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="border-b bg-gradient-to-br from-brand-soft to-transparent px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Invoice summary</p>
          <p className="mt-1 truncate text-lg font-semibold tracking-tight" data-testid="summary-customer">{customerLabel}</p>
          <p className="truncate text-sm text-muted-foreground">{v.invoiceType === "company" ? v.customerName || "Primary contact" : v.customerEmail || "Customer email"}</p>
        </div>
        <dl className="divide-y text-sm">
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">Courses</dt>
            <dd className="text-right font-medium" data-testid="summary-courses">
              {v.courseSelectionMode === "all_including_future" ? `All (${published.length}) + future` : `${selectedCourses.length} selected`}
            </dd>
          </div>
          {selectedCourses.length > 0 ? (
            <div className="px-5 py-3">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {selectedCourses.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5 truncate">
                    <Check className="size-3 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{c.title}</span>
                  </li>
                ))}
                {selectedCourses.length > 6 ? <li className="pl-4">and {selectedCourses.length - 6} more</li> : null}
              </ul>
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">Collected by</dt>
            <dd className="text-right font-medium" data-testid="summary-method">{viaLink ? "Direct payment link" : "Whop invoice"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">Billing</dt>
            <dd className="text-right font-medium">{recurring ? `${billingIntervalLabel(interval)} subscription` : "One-time payment"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">Access</dt>
            <dd className="text-right font-medium" data-testid="summary-access">{accessLabel}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">If paid today</dt>
            <dd className="text-right font-medium">{estimatedExpiry ? `Ends ${fmtDate(estimatedExpiry)}` : recurring ? "Renews until cancelled" : "Never expires"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="text-right font-medium">{(v.currency ?? "usd").toUpperCase()}</dd>
          </div>
        </dl>
        <div className="border-t bg-muted/30 px-5 py-4">
          <p className="text-xs text-muted-foreground">{recurring ? "First payment" : "Amount due"}</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums" data-testid="summary-amount">
            {amountMinor === null ? "—" : money(amountMinor + (feeMinor ?? 0))}
          </p>
          {recurring && amountMinor !== null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Then {money(amountMinor)} every {intervalNoun(interval)}
              {v.billingCycles ? ` · ${v.billingCycles} payments in total` : ""}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">Tax, if any, is calculated by Whop when the invoice is issued.</p>
        </div>
      </div>
    </aside>
  );

  // ---- Review -----------------------------------------------------------------
  if (stage === "review") {
    const rows: [string, React.ReactNode][] = [
      ["Customer type", v.invoiceType === "company" ? "Company / organisation" : "Individual"],
      ...(v.invoiceType === "company" ? ([["Company", customerLabel]] as [string, React.ReactNode][]) : []),
      [v.invoiceType === "company" ? "Primary contact" : "Customer", `${v.customerName} · ${v.customerEmail}`],
      ["Service description", v.invoiceDescription],
      [
        "Courses",
        v.courseSelectionMode === "all_including_future"
          ? `All ${published.length} published courses, plus courses published while access lasts`
          : v.courseSelectionMode === "all_published"
            ? `All ${published.length} currently published courses (snapshot)`
            : selectedCourses.map((c) => c.title).join(", "),
      ],
      ["Collected by", viaLink ? "Direct Whop payment link (client pays without signing in first; payable once)" : "Official Whop invoice (client signs in to Whop as the invoiced email to pay)"],
      ["Payment", recurring ? `${money(amountMinor)} ${billingIntervalLabel(interval).toLowerCase()}${feeMinor ? ` + ${money(feeMinor)} upfront fee` : ""}` : `${money(amountMinor)} once`],
      ["Access", accessLabel],
      ...(recurring ? ([["Grace period", `${v.gracePeriodDays ?? 0} days after a failed renewal`]] as [string, React.ReactNode][]) : []),
      ["Due date", v.dueDate ? fmtDate(new Date(`${v.dueDate}T00:00:00Z`)) : "On receipt"],
      ...(v.linkExpiryDate ? ([["Payment link expires", fmtDate(new Date(`${v.linkExpiryDate}T00:00:00Z`))]] as [string, React.ReactNode][]) : []),
      ...(v.invoiceType === "company"
        ? ([
            ["Team invitations", v.allowContactInvites ? "Company contact and Foremint admins can invite employees" : "Only Foremint admins can invite employees"],
            ["Seat limit", v.seatLimit ? `${v.seatLimit} people` : "Unlimited"],
          ] as [string, React.ReactNode][])
        : []),
    ];
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Review the commercial terms</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {viaLink
                ? "Creating the link sets up a hidden Whop product just for this deal, so public plans and course prices stay unchanged. Access starts only after Whop confirms payment."
                : "Generating creates an official Whop invoice with its own hidden product, so public plans and course prices stay unchanged. Access starts only after Whop confirms payment."}
            </p>
            <dl className="mt-5 divide-y rounded-xl border">
              {rows.map(([k, val]) => (
                <div key={k} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium break-words">{val}</dd>
                </div>
              ))}
            </dl>
            {!whopReady ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Whop isn&rsquo;t connected yet, so the invoice can only be saved as a draft.
              </p>
            ) : null}
            <label className="mt-5 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} className="mt-0.5" data-testid="confirm-terms" />
              <span>I confirm the customer agreed to these terms: the amount, currency, billing schedule, courses and access period above.</span>
            </label>
            {errors._?.length ? <p className="mt-3 text-sm text-destructive">{errors._[0]}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStage("edit")} disabled={pending}>
                <ArrowLeft aria-hidden />
                Back to edit
              </Button>
              <Button type="button" variant="outline" onClick={saveDraft} disabled={pending}>
                Save as draft
              </Button>
              <Button type="button" onClick={generate} disabled={!confirmed || !whopReady || pending} data-testid="generate-invoice">
                {viaLink ? <Link2 aria-hidden /> : <Sparkles aria-hidden />}
                {viaLink ? "Create payment link" : "Generate Whop invoice"}
              </Button>
            </div>
          </div>
        </div>
        {summary}
      </div>
    );
  }

  // ---- Edit -------------------------------------------------------------------
  const sectionClass = "scroll-mt-24 rounded-2xl border bg-card p-5 shadow-card sm:p-6";
  const stepHeader = (n: number, title: string, description?: string) => (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-primary">{n}</span>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form
        className="min-w-0 space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          goReview();
        }}
      >
        {revisionNumber ? (
          <p className="rounded-xl border border-primary/20 bg-brand-soft px-4 py-3 text-sm text-primary">
            Revising {revisionNumber}. The original stays open until you void it from its invoice page.
          </p>
        ) : null}

        <nav aria-label="Invoice sections" className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => {
            const hasError = Object.keys(errors).some((k) => FIELD_STEP[k] === s.key);
            return (
              <a
                key={s.key}
                href={`#section-${s.key}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-foreground",
                  hasError ? "border-destructive/40 text-destructive" : "text-muted-foreground",
                )}
              >
                <s.icon className="size-3.5" aria-hidden />
                {i + 1}. {s.label}
              </a>
            );
          })}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">5. Review</span>
        </nav>

        {/* 1. Customer */}
        <section id="section-customer" className={sectionClass}>
          {stepHeader(1, "Customer", "Who is buying. Internal notes are never shown to the customer.")}
          <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Customer type">
            {(
              [
                { value: "individual", title: "Individual customer", body: "One person gets access on their own account.", icon: CircleUserRound },
                { value: "company", title: "Company / organisation", body: "A shared package for every invited employee.", icon: Building2 },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={v.invoiceType === o.value}
                onClick={() => set("invoiceType", o.value)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                  v.invoiceType === o.value ? "border-primary bg-brand-soft/60 ring-1 ring-primary" : "hover:border-primary/40",
                )}
                data-testid={`customer-type-${o.value}`}
              >
                <o.icon className={cn("mt-0.5 size-5 shrink-0", v.invoiceType === o.value ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.body}</span>
                </span>
              </button>
            ))}
          </div>

          {v.invoiceType === "company" ? (
            <div className="mb-5 grid gap-4">
              {companies.length ? (
                <div className="flex flex-wrap gap-2 text-sm">
                  <Button type="button" size="sm" variant={v.companyMode === "new" ? "default" : "outline"} onClick={() => set("companyMode", "new")}>
                    New company
                  </Button>
                  <Button type="button" size="sm" variant={v.companyMode === "existing" ? "default" : "outline"} onClick={() => set("companyMode", "existing")}>
                    Existing company
                  </Button>
                </div>
              ) : null}
              {v.companyMode === "existing" && companies.length ? (
                <Field>
                  <FieldLabel htmlFor="existingCompanyId">Company</FieldLabel>
                  <Select
                    value={v.existingCompanyId ?? ""}
                    onValueChange={(id) => {
                      set("existingCompanyId", id);
                      const c = companies.find((x) => x.id === id);
                      if (c && !v.customerEmail) set("customerEmail", c.primary_contact_email);
                    }}
                  >
                    <SelectTrigger id="existingCompanyId" className="w-full">
                      <SelectValue placeholder="Choose a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>The new package is added to this company&rsquo;s workspace and members.</FieldDescription>
                  {err("existingCompanyId")}
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="companyName">Company name</FieldLabel>
                  <Input id="companyName" value={v.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} placeholder="ABC Digital Solutions" maxLength={200} aria-invalid={Boolean(errors.companyName)} />
                  {err("companyName")}
                </Field>
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="customerName">{v.invoiceType === "company" ? "Primary contact name" : "Full name"}</FieldLabel>
              <Input id="customerName" value={v.customerName ?? ""} onChange={(e) => set("customerName", e.target.value)} autoComplete="off" maxLength={160} aria-invalid={Boolean(errors.customerName)} />
              {err("customerName")}
            </Field>
            <Field>
              <FieldLabel htmlFor="customerEmail">{v.invoiceType === "company" ? "Primary contact email" : "Email address"}</FieldLabel>
              <Input id="customerEmail" type="email" value={v.customerEmail ?? ""} onChange={(e) => set("customerEmail", e.target.value)} autoComplete="off" maxLength={254} aria-invalid={Boolean(errors.customerEmail)} />
              <FieldDescription>Receives the payment link and, once paid, the account set-up email.</FieldDescription>
              {err("customerEmail")}
            </Field>
            <Field>
              <FieldLabel htmlFor="customerPhone">Phone (optional)</FieldLabel>
              <Input id="customerPhone" type="tel" value={v.customerPhone ?? ""} onChange={(e) => set("customerPhone", e.target.value)} maxLength={40} />
            </Field>
          </div>

          {v.invoiceType === "company" ? (
            <div className="mt-4 grid gap-4">
              <Field>
                <FieldLabel htmlFor="companyDescription">Company description</FieldLabel>
                <Textarea id="companyDescription" rows={3} value={v.companyDescription ?? ""} onChange={(e) => set("companyDescription", e.target.value)} maxLength={4000} placeholder="What the company does, in a sentence or two." />
              </Field>
              <Field>
                <FieldLabel htmlFor="companyServices">Services the company provides</FieldLabel>
                <Textarea id="companyServices" rows={3} value={v.companyServices ?? ""} onChange={(e) => set("companyServices", e.target.value)} maxLength={4000} placeholder="e.g. Amazon account management, Shopify builds, paid social campaigns." />
                <FieldDescription>Both appear on the branded service summary.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="seatLimit">Seat limit (optional)</FieldLabel>
                  <Input id="seatLimit" type="number" min={1} value={v.seatLimit == null ? "" : String(v.seatLimit)} onChange={(e) => set("seatLimit", e.target.value === "" ? null : Number(e.target.value))} placeholder="Unlimited" />
                  <FieldDescription>Active members plus pending invitations.</FieldDescription>
                </Field>
                <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
                  <Label htmlFor="allowContactInvites" className="grid gap-1 font-normal">
                    <span className="text-sm font-medium">Company contact can invite employees</span>
                    <span className="text-xs text-muted-foreground">Foremint admins can always invite.</span>
                  </Label>
                  <Switch id="allowContactInvites" checked={v.allowContactInvites ?? true} onCheckedChange={(c) => set("allowContactInvites", c)} />
                </div>
              </div>
            </div>
          ) : null}

          <Field className="mt-4">
            <FieldLabel htmlFor="internalNotes">Internal notes (optional)</FieldLabel>
            <Textarea id="internalNotes" rows={2} value={v.internalNotes ?? ""} onChange={(e) => set("internalNotes", e.target.value)} maxLength={4000} placeholder="Visible to Foremint admins only." />
          </Field>
        </section>

        {/* 2. Description */}
        <section id="section-description" className={sectionClass}>
          {stepHeader(2, "Invoice description", "Summarise the service being purchased.")}
          <div className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="invoiceDescription">Description</FieldLabel>
              <Input id="invoiceDescription" value={v.invoiceDescription ?? ""} onChange={(e) => set("invoiceDescription", e.target.value)} maxLength={500} placeholder="Custom Digital Business Training Package — 2026" aria-invalid={Boolean(errors.invoiceDescription)} />
              {err("invoiceDescription")}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customerReference">Customer reference / PO (optional)</FieldLabel>
                <Input id="customerReference" value={v.customerReference ?? ""} onChange={(e) => set("customerReference", e.target.value)} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="internalReference">Internal reference (optional)</FieldLabel>
                <Input id="internalReference" value={v.internalReference ?? ""} onChange={(e) => set("internalReference", e.target.value)} maxLength={120} />
              </Field>
            </div>
          </div>
        </section>

        {/* 3. Courses */}
        <section id="section-courses" className={sectionClass}>
          {stepHeader(3, "Courses", "Pick from the course catalogue. A snapshot of titles is saved with the invoice.")}
          <div className="mb-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Course selection">
            {(
              [
                { value: "selected", title: "Selected courses", body: "Choose specific courses." },
                { value: "all_published", title: "All published courses", body: `The ${published.length} courses published today.` },
                { value: "all_including_future", title: "All, including future", body: "Also courses published while access lasts." },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={v.courseSelectionMode === o.value}
                onClick={() => set("courseSelectionMode", o.value)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-colors",
                  v.courseSelectionMode === o.value ? "border-primary bg-brand-soft/60 ring-1 ring-primary" : "hover:border-primary/40",
                )}
                data-testid={`course-mode-${o.value}`}
              >
                <span className="block text-sm font-semibold">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.body}</span>
              </button>
            ))}
          </div>

          {v.courseSelectionMode === "selected" ? (
            <>
              {(v.courseIds ?? []).length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Selected courses">
                  {(v.courseIds ?? []).map((id) => {
                    const c = courses.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-xs font-medium text-primary">
                        {c.title}
                        <button type="button" onClick={() => toggleCourse(id, false)} className="grid size-5 place-items-center rounded-full hover:bg-primary/10" aria-label={`Remove ${c.title}`}>
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} placeholder="Search courses, categories or instructors" className="pl-9" aria-label="Search courses" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="sm:w-56" aria-label="Filter by category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-xl border">
                {visibleCourses.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No courses match.</p>
                ) : (
                  <ul className="divide-y">
                    {visibleCourses.map((c) => {
                      const eligible = c.status === "published";
                      const checked = (v.courseIds ?? []).includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className={cn("flex items-center gap-3 px-4 py-3 text-sm", eligible ? "cursor-pointer hover:bg-muted/40" : "cursor-not-allowed opacity-60")}>
                            <Checkbox checked={checked} disabled={!eligible} onCheckedChange={(on) => toggleCourse(c.id, on === true)} aria-label={c.title} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{c.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">{[c.category, c.instructor].filter(Boolean).join(" · ") || "Uncategorised"}</span>
                            </span>
                            <StatusBadge status={c.status} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{(v.courseIds ?? []).length} selected · only published courses can be sold</span>
                <span className="flex gap-2">
                  <Button type="button" variant="ghost" size="xs" onClick={() => set("courseIds", [...new Set([...(v.courseIds ?? []), ...visibleCourses.filter((c) => c.status === "published").map((c) => c.id)])])}>
                    Select all shown
                  </Button>
                  <Button type="button" variant="ghost" size="xs" onClick={() => set("courseIds", [])}>
                    Clear
                  </Button>
                </span>
              </div>
              {err("courseIds")}
            </>
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <p className="font-medium">
                {published.length} published course{published.length === 1 ? "" : "s"} included
                {v.courseSelectionMode === "all_including_future" ? ", plus every course published while access lasts" : " (new courses are not added later)"}
              </p>
              <p className="mt-1 text-muted-foreground">{published.map((c) => c.title).join(", ")}</p>
            </div>
          )}
        </section>

        {/* 4. Payment */}
        <section id="section-payment" className={sectionClass}>
          {stepHeader(4, "Payment & access", "The amount you agreed with the customer. It replaces the courses' public prices.")}
          <div className="mb-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How the client pays">
            {(
              [
                { value: "payment_link", title: "Direct payment link", body: "Send one link; your client pays on Whop's secure checkout straight away. It can be paid once.", icon: Link2 },
                { value: "whop_invoice", title: "Official Whop invoice", body: "Numbered Whop invoice with PDF and reminders. Your client signs in to Whop as the invoiced email to pay.", icon: FileText },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={(v.collectionMethod ?? "payment_link") === o.value}
                onClick={() => set("collectionMethod", o.value)}
                className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-colors", (v.collectionMethod ?? "payment_link") === o.value ? "border-primary bg-brand-soft/60 ring-1 ring-primary" : "hover:border-primary/40")}
                data-testid={`method-${o.value}`}
              >
                <o.icon className={cn("mt-0.5 size-5 shrink-0", (v.collectionMethod ?? "payment_link") === o.value ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">
                    {o.title}
                    {o.value === "payment_link" ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[0.65rem] font-semibold text-primary">Recommended</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{o.body}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Select value={v.currency ?? "usd"} onValueChange={(c) => set("currency", c)}>
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code.toUpperCase()} · {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">{recurring ? "Recurring price" : "Amount"}</FieldLabel>
              <Input id="amount" inputMode="decimal" value={v.amount ?? ""} onChange={(e) => set("amount", e.target.value)} placeholder="500.00" aria-invalid={Boolean(errors.amount)} data-testid="amount" />
              <FieldDescription>{amountMinor !== null ? `${money(amountMinor)}${recurring ? ` every ${intervalNoun(interval)}` : ""}` : "Whop's minimum is 1.00."}</FieldDescription>
              {err("amount")}
            </Field>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment type">
            {(
              [
                { value: "one_time", title: "One-time payment", body: "Paid once; access for a set period.", icon: InfinityIcon },
                { value: "recurring", title: "Recurring subscription", body: "Charged every period; access while active.", icon: Repeat },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={v.billingType === o.value}
                onClick={() => set("billingType", o.value)}
                className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-colors", v.billingType === o.value ? "border-primary bg-brand-soft/60 ring-1 ring-primary" : "hover:border-primary/40")}
                data-testid={`billing-${o.value}`}
              >
                <o.icon className={cn("mt-0.5 size-5 shrink-0", v.billingType === o.value ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.body}</span>
                </span>
              </button>
            ))}
          </div>

          {!recurring ? (
            <div className="mt-5 grid gap-4">
              <Field>
                <FieldLabel>Access period</FieldLabel>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Access period">
                  {[...ACCESS_DAY_PRESETS.map((d) => ({ value: String(d) as AccessChoice, label: d === 365 ? "365 days" : `${d} days` })), { value: "custom" as AccessChoice, label: "Custom days" }, { value: "until_date" as AccessChoice, label: "Until a date" }, ...(defaults.allowLifetime ? [{ value: "lifetime" as AccessChoice, label: "Lifetime" }] : [])].map((o) => (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      role="radio"
                      aria-checked={accessChoice === o.value}
                      variant={accessChoice === o.value ? "default" : "outline"}
                      onClick={() => {
                        setAccessChoice(o.value);
                        if (o.value === "lifetime") set("accessMode", "lifetime");
                        else if (o.value === "until_date") set("accessMode", "until_date");
                        else {
                          set("accessMode", "days");
                          if (o.value !== "custom") set("accessDurationDays", Number(o.value));
                        }
                      }}
                      data-testid={`access-${o.value}`}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
                <FieldDescription>Counted from the moment Whop confirms payment, not from today.</FieldDescription>
              </Field>
              {accessChoice === "custom" ? (
                <Field className="max-w-xs">
                  <FieldLabel htmlFor="accessDurationDays">Days of access</FieldLabel>
                  <Input id="accessDurationDays" type="number" min={1} max={3650} value={v.accessDurationDays == null ? "" : String(v.accessDurationDays)} onChange={(e) => set("accessDurationDays", e.target.value === "" ? null : Number(e.target.value))} aria-invalid={Boolean(errors.accessDurationDays)} />
                  {err("accessDurationDays")}
                </Field>
              ) : null}
              {accessChoice === "until_date" ? (
                <Field className="max-w-xs">
                  <FieldLabel htmlFor="accessEndDate">Access ends on</FieldLabel>
                  <Input id="accessEndDate" type="date" value={v.accessEndDate ?? ""} onChange={(e) => set("accessEndDate", e.target.value || null)} aria-invalid={Boolean(errors.accessEndDate)} />
                  {err("accessEndDate")}
                </Field>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <Field>
                <FieldLabel>Billing interval</FieldLabel>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Billing interval">
                  {[...BILLING_INTERVAL_PRESETS.map((p) => ({ value: String(p.days), label: p.label })), { value: "custom", label: "Custom" }].map((o) => (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      role="radio"
                      aria-checked={intervalChoice === o.value}
                      variant={intervalChoice === o.value ? "default" : "outline"}
                      onClick={() => {
                        setIntervalChoice(o.value);
                        if (o.value !== "custom") set("billingIntervalDays", Number(o.value));
                      }}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
                <FieldDescription>Billing is how often Whop charges. Access lasts while the subscription is paid up, not just one interval.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                {intervalChoice === "custom" ? (
                  <Field>
                    <FieldLabel htmlFor="billingIntervalDays">Every … days</FieldLabel>
                    <Input id="billingIntervalDays" type="number" min={2} max={365} value={v.billingIntervalDays == null ? "" : String(v.billingIntervalDays)} onChange={(e) => set("billingIntervalDays", e.target.value === "" ? null : Number(e.target.value))} aria-invalid={Boolean(errors.billingIntervalDays)} />
                    {err("billingIntervalDays")}
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="billingCycles">Number of payments</FieldLabel>
                  <Input id="billingCycles" type="number" min={2} max={115} value={v.billingCycles == null ? "" : String(v.billingCycles)} onChange={(e) => set("billingCycles", e.target.value === "" ? null : Number(e.target.value))} placeholder="Until cancelled" aria-invalid={Boolean(errors.billingCycles)} />
                  <FieldDescription>For a fixed-term contract (2–115). Access ends after the last paid period.</FieldDescription>
                  {err("billingCycles")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="upfrontFee">Upfront fee (optional)</FieldLabel>
                  <Input id="upfrontFee" inputMode="decimal" value={v.upfrontFee ?? ""} onChange={(e) => set("upfrontFee", e.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.upfrontFee)} />
                  <FieldDescription>Added once to the first payment.</FieldDescription>
                  {err("upfrontFee")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="gracePeriodDays">Grace period (days)</FieldLabel>
                  <Input id="gracePeriodDays" type="number" min={0} max={60} value={v.gracePeriodDays == null ? "0" : String(v.gracePeriodDays)} onChange={(e) => set("gracePeriodDays", e.target.value === "" ? 0 : Number(e.target.value))} />
                  <FieldDescription>Access kept after a failed renewal.</FieldDescription>
                </Field>
              </div>
              <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Whop invoices start the subscription at the first payment, so free trials aren&rsquo;t available on custom invoices.</p>
            </div>
          )}

          <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="dueDate">Payment due date</FieldLabel>
              <Input id="dueDate" type="date" value={v.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || null)} aria-invalid={Boolean(errors.dueDate)} />
              <FieldDescription>Shown on Whop&rsquo;s invoice; marks the invoice past due afterwards.</FieldDescription>
              {err("dueDate")}
            </Field>
            <Field>
              <FieldLabel htmlFor="linkExpiryDate">Payment link expires (optional)</FieldLabel>
              <Input id="linkExpiryDate" type="date" value={v.linkExpiryDate ?? ""} onChange={(e) => set("linkExpiryDate", e.target.value || null)} aria-invalid={Boolean(errors.linkExpiryDate)} />
              <FieldDescription>After this date the Whop invoice is voided and the link stops working.</FieldDescription>
              {err("linkExpiryDate")}
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border bg-card p-4 shadow-card">
          {Object.keys(errors).length ? <p className="mr-auto text-sm text-destructive">Fix the highlighted fields to continue.</p> : null}
          <Button type="button" variant="outline" onClick={saveDraft} disabled={pending}>
            Save as draft
          </Button>
          <Button type="submit" disabled={pending} data-testid="review-invoice">
            Review invoice
          </Button>
        </div>
      </form>
      {summary}
    </div>
  );
}
