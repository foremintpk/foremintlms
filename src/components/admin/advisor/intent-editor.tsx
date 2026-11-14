"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import type { FollowUp } from "@/lib/domain/advisor";
import {
  addKeywordAction,
  addRecommendationAction,
  createIntentAction,
  deleteIntentAction,
  deleteKeywordAction,
  deleteRecommendationAction,
  setIntentActiveAction,
  testAdvisorMessageAction,
  updateIntentAction,
  updateKeywordAction,
  updateRecommendationAction,
  type TestResult,
} from "@/app/admin/advisor/actions";

const err = (fieldErrors: Record<string, string[]>, key: string) => (fieldErrors[key]?.[0] ? <FieldError>{fieldErrors[key][0]}</FieldError> : null);

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function CreateIntentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, fieldErrors } = useAction(createIntentAction, {
    onSuccess: ({ id }) => {
      setOpen(false);
      router.push(`/admin/advisor/intents/${id}`);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New intent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New intent</DialogTitle>
          <DialogDescription>An intent is a goal visitors express (“build websites”). Add keywords and courses on the next screen.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({ intent_key: String(f.get("intent_key") ?? ""), title: String(f.get("title") ?? ""), response: String(f.get("response") ?? "") });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="intent-title">Title</FieldLabel>
              <Input id="intent-title" name="title" required maxLength={120} placeholder="Build websites" />
              {err(fieldErrors, "title")}
            </Field>
            <Field>
              <FieldLabel htmlFor="intent-key">Key</FieldLabel>
              <Input id="intent-key" name="intent_key" required maxLength={60} placeholder="website_development" className="font-mono" />
              <FieldDescription>Lowercase letters, numbers and underscores. Used in follow-up paths and analytics; it can&apos;t be changed later.</FieldDescription>
              {err(fieldErrors, "intent_key")}
            </Field>
            <Field>
              <FieldLabel htmlFor="intent-response">What the advisor says</FieldLabel>
              <Textarea id="intent-response" name="response" required maxLength={1200} rows={3} />
              {err(fieldErrors, "response")}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create intent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function IntentActiveSwitch({ id, active, label }: { id: string; active: boolean; label: string }) {
  const router = useRouter();
  const { run, pending } = useAction(setIntentActiveAction, { onSuccess: () => router.refresh() });
  return <Switch checked={active} disabled={pending} onCheckedChange={(v) => void run({ id, active: v })} aria-label={`${active ? "Disable" : "Enable"} ${label}`} />;
}

// ---------------------------------------------------------------------------
// Details + follow-up
// ---------------------------------------------------------------------------

export interface IntentFormValue {
  id: string;
  intent_key: string;
  title: string;
  description: string | null;
  response: string;
  priority: number;
  is_active: boolean;
  followUp: FollowUp | null;
}

export function IntentDetailsForm({ intent, intentOptions }: { intent: IntentFormValue; intentOptions: { key: string; title: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(intent.title);
  const [description, setDescription] = useState(intent.description ?? "");
  const [response, setResponse] = useState(intent.response);
  const [priority, setPriority] = useState(String(intent.priority));
  const [active, setActive] = useState(intent.is_active);
  const [hasFollowUp, setHasFollowUp] = useState(Boolean(intent.followUp));
  const [question, setQuestion] = useState(intent.followUp?.question ?? "");
  const [options, setOptions] = useState<{ label: string; intent: string }[]>(intent.followUp?.options ?? []);
  const { run, pending, fieldErrors } = useAction(updateIntentAction, { onSuccess: () => router.refresh() });
  const choices = intentOptions.filter((o) => o.key !== intent.intent_key);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = options.map((o) => ({ label: o.label.trim(), intent: o.intent })).filter((o) => o.label && o.intent);
    void run({
      id: intent.id,
      title,
      description: description || null,
      response,
      priority: Number(priority) || 0,
      is_active: active,
      follow_up: hasFollowUp ? { question: question.trim(), options: cleaned } : null,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="text-base font-semibold">Details</h2>
        <FieldGroup className="mt-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field>
              <FieldLabel htmlFor="i-title">Title</FieldLabel>
              <Input id="i-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
              {err(fieldErrors, "title")}
            </Field>
            <Field>
              <FieldLabel htmlFor="i-priority">Priority</FieldLabel>
              <Input id="i-priority" type="number" min={-100} max={100} value={priority} onChange={(e) => setPriority(e.target.value)} />
              {err(fieldErrors, "priority")}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="i-description">Internal description</FieldLabel>
            <Input id="i-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="When this intent should match" />
          </Field>
          <Field>
            <FieldLabel htmlFor="i-response">What the advisor says</FieldLabel>
            <Textarea id="i-response" value={response} onChange={(e) => setResponse(e.target.value)} maxLength={1200} rows={4} required />
            <FieldDescription>Shown before the recommended courses. Only describe what the courses really cover. {response.length}/1200</FieldDescription>
            {err(fieldErrors, "response")}
          </Field>
          <Field orientation="horizontal">
            <Switch id="i-active" checked={active} onCheckedChange={setActive} />
            <FieldLabel htmlFor="i-active">Active — the advisor can match this intent</FieldLabel>
          </Field>
          <p className="text-xs text-muted-foreground">
            Priority breaks ties between intents that score the same. Key: <span className="font-mono">{intent.intent_key}</span>
          </p>
        </FieldGroup>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Follow-up question</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ask a guided question after this intent matches. Each answer leads to another intent — that&apos;s how decision paths are built.</p>
          </div>
          <Switch checked={hasFollowUp} onCheckedChange={setHasFollowUp} aria-label="Ask a follow-up question" />
        </div>
        {hasFollowUp ? (
          <FieldGroup className="mt-4">
            <Field>
              <FieldLabel htmlFor="fu-question">Question</FieldLabel>
              <Input id="fu-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Which direction interests you most?" />
            </Field>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Answers</p>
              {options.map((o, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={o.label} onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} maxLength={80} placeholder="Answer shown as a button" aria-label={`Answer ${i + 1} label`} />
                  <Select value={o.intent} onValueChange={(v) => setOptions((all) => all.map((x, j) => (j === i ? { ...x, intent: v } : x)))}>
                    <SelectTrigger aria-label={`Answer ${i + 1} leads to`}>
                      <SelectValue placeholder="Leads to intent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} aria-label={`Remove answer ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {options.length < 8 ? (
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setOptions((all) => [...all, { label: "", intent: "" }])}>
                  <Plus className="size-4" /> Add answer
                </Button>
              ) : null}
              {fieldErrors.follow_up?.[0] ? <FieldError>{fieldErrors.follow_up[0].startsWith("Unknown") ? fieldErrors.follow_up[0] : "Add a question and at least one answer with a label and an intent."}</FieldError> : null}
            </div>
          </FieldGroup>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save intent"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

export interface KeywordItem {
  id: string;
  keyword: string;
  match_type: "keyword" | "phrase" | "pattern";
  weight: number;
  is_active: boolean;
}

const MATCH_LABEL = { keyword: "Keyword", phrase: "Phrase", pattern: "Pattern" } as const;

export function KeywordsEditor({ intentId, keywords }: { intentId: string; keywords: KeywordItem[] }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<KeywordItem["match_type"]>("phrase");
  const [weight, setWeight] = useState("2");
  const add = useAction(addKeywordAction, {
    onSuccess: () => {
      setKeyword("");
      router.refresh();
    },
  });
  const update = useAction(updateKeywordAction, { onSuccess: () => router.refresh(), silent: true });

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold">Keywords and phrases</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Keyword</strong>: one word anywhere in the message. <strong className="font-medium text-foreground">Phrase</strong>: these words together, in this order.{" "}
        <strong className="font-medium text-foreground">Pattern</strong>: words in order where <span className="font-mono">*</span> allows 0–3 other words (<span className="font-mono">build * app</span> matches “build an Android app”). Plurals and -ing forms
        match automatically, and synonyms apply first. Weight sets how strongly a match counts (an intent needs a total of 1.5).
      </p>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_100px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add.run({ intent_id: intentId, keyword, match_type: type, weight: Number(weight) });
        }}
      >
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={type === "pattern" ? "build * app" : type === "keyword" ? "shopify" : "online store"} maxLength={120} aria-label="Keyword or phrase" />
        <Select value={type} onValueChange={(v) => setType(v as KeywordItem["match_type"])}>
          <SelectTrigger aria-label="Match type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">Keyword</SelectItem>
            <SelectItem value="phrase">Phrase</SelectItem>
            <SelectItem value="pattern">Pattern</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0.1} max={10} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Weight" />
        <Button type="submit" disabled={add.pending || !keyword.trim()}>
          {add.pending ? "Adding…" : "Add"}
        </Button>
      </form>
      {add.fieldErrors.keyword?.[0] || add.fieldErrors.weight?.[0] ? <p className="mt-2 text-sm text-destructive">{add.fieldErrors.keyword?.[0] ?? add.fieldErrors.weight?.[0]}</p> : null}

      {keywords.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No keywords yet — this intent can&apos;t match anything until you add some.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Text</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Weight</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {keywords.map((k) => (
                <tr key={k.id} className={k.is_active ? "" : "opacity-60"}>
                  <td className="px-3 py-2 font-mono text-[0.8rem]">{k.keyword}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{MATCH_LABEL[k.match_type]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      defaultValue={k.weight}
                      className="h-8 w-20"
                      aria-label={`Weight for ${k.keyword}`}
                      onBlur={(e) => {
                        const w = Number(e.target.value);
                        if (w !== Number(k.weight) && w >= 0.1 && w <= 10) void update.run({ id: k.id, weight: w });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch checked={k.is_active} onCheckedChange={(v) => void update.run({ id: k.id, is_active: v })} aria-label={`${k.is_active ? "Disable" : "Enable"} ${k.keyword}`} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${k.keyword}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                      title="Remove this keyword?"
                      description={k.keyword}
                      confirmLabel="Remove keyword"
                      destructive
                      action={() => deleteKeywordAction({ id: k.id })}
                      onDone={() => router.refresh()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Course recommendations
// ---------------------------------------------------------------------------

export interface RecommendationItem {
  id: string;
  course_id: string;
  courseTitle: string;
  courseStatus: string | null;
  role: "primary" | "supporting";
  recommendation_priority: number;
  explanation: string | null;
  is_active: boolean;
}

export function RecommendationsEditor({ intentId, items, courses }: { intentId: string; items: RecommendationItem[]; courses: { id: string; title: string; status: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState("");
  const [role, setRole] = useState<"primary" | "supporting">("primary");
  const [explanation, setExplanation] = useState("");
  const used = new Set(items.map((i) => i.course_id));
  const available = courses.filter((c) => !used.has(c.id));
  const add = useAction(addRecommendationAction, {
    onSuccess: () => {
      setCourseId("");
      setExplanation("");
      router.refresh();
    },
  });

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-base font-semibold">Recommended courses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown as cards with their live price when this intent matches (up to four across all matched intents). Primary courses come first, then supporting ones, each by priority. Unpublished courses and
        courses without a price for the visitor&apos;s access period are never shown.
      </p>
      <form
        className="mt-4 grid gap-2 lg:grid-cols-[1fr_150px]"
        onSubmit={(e) => {
          e.preventDefault();
          void add.run({ intent_id: intentId, course_id: courseId, role, recommendation_priority: items.length + 1, explanation: explanation || null });
        }}
      >
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger aria-label="Course">
            <SelectValue placeholder={available.length ? "Choose a course…" : "Every course is already added"} />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
                {c.status !== "published" ? " (not published)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => setRole(v as "primary" | "supporting")}>
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="supporting">Supporting</SelectItem>
          </SelectContent>
        </Select>
        <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={400} placeholder="Why this course fits (shown under the card)" className="lg:col-span-2" aria-label="Explanation" />
        <Button type="submit" disabled={add.pending || !courseId} className="justify-self-start">
          {add.pending ? "Adding…" : "Add course"}
        </Button>
      </form>
      {add.fieldErrors.course_id?.[0] ? <p className="mt-2 text-sm text-destructive">{add.fieldErrors.course_id[0]}</p> : null}

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No courses yet. Intents without courses can still ask a follow-up question or simply reply.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((r) => (
            <RecommendationRow key={r.id} item={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecommendationRow({ item }: { item: RecommendationItem }) {
  const router = useRouter();
  const [role, setRole] = useState(item.role);
  const [priority, setPriority] = useState(String(item.recommendation_priority));
  const [explanation, setExplanation] = useState(item.explanation ?? "");
  const [active, setActive] = useState(item.is_active);
  const save = useAction(updateRecommendationAction, { onSuccess: () => router.refresh() });
  const dirty = role !== item.role || Number(priority) !== item.recommendation_priority || explanation !== (item.explanation ?? "") || active !== item.is_active;
  return (
    <li className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 font-medium">{item.courseTitle}</p>
        {item.courseStatus && item.courseStatus !== "published" ? <Badge variant="outline">Not published</Badge> : null}
        <Switch checked={active} onCheckedChange={setActive} aria-label={`${active ? "Disable" : "Enable"} ${item.courseTitle}`} />
        <ConfirmAction
          trigger={
            <Button variant="ghost" size="icon-xs" aria-label={`Remove ${item.courseTitle}`}>
              <Trash2 className="size-3.5" />
            </Button>
          }
          title="Remove this course from the intent?"
          description={item.courseTitle}
          confirmLabel="Remove course"
          destructive
          action={() => deleteRecommendationAction({ id: item.id })}
          onDone={() => router.refresh()}
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[150px_100px_1fr_auto]">
        <Select value={role} onValueChange={(v) => setRole(v as "primary" | "supporting")}>
          <SelectTrigger aria-label="Role" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primary</SelectItem>
            <SelectItem value="supporting">Supporting</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={-100} max={100} value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9" aria-label="Priority (lower shows first)" title="Priority — lower shows first" />
        <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={400} className="h-9" placeholder="Why this course fits" aria-label="Explanation" />
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={!dirty || save.pending}
          onClick={() => void save.run({ id: item.id, role, recommendation_priority: Number(priority) || 0, explanation: explanation || null, is_active: active })}
        >
          {save.pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Rule tester
// ---------------------------------------------------------------------------

export function TestMessageBox({ placeholder }: { placeholder?: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const test = useAction(testAdvisorMessageAction, { silent: true, onSuccess: setResult });
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <FlaskConical className="size-4 text-primary" aria-hidden /> Test a message
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">See exactly how the advisor would answer, using the saved rules. Nothing is logged.</p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void test.run({ text });
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={placeholder ?? "I want to build apps for Android and iPhone"} aria-label="Message to test" />
        <Button type="submit" disabled={test.pending || !text.trim()}>
          {test.pending ? "Testing…" : "Test"}
        </Button>
      </form>
      {test.error ? <p className="mt-2 text-sm text-destructive">{test.error}</p> : null}
      {result ? (
        <div className="mt-4 grid gap-3 text-sm" role="status">
          <p className="rounded-xl bg-brand-soft/60 p-3">
            <span className="font-semibold capitalize">{result.decision.replace("_", " ")}</span> — {result.detail}
          </p>
          {result.intents.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Intent</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Matched</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.intents.map((i) => (
                    <tr key={i.key}>
                      <td className="px-3 py-2">{i.key}</td>
                      <td className="px-3 py-2 tabular-nums">{i.score}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i.matched.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">No intent keyword matched.</p>
          )}
          {result.faqs.length ? (
            <p className="text-muted-foreground">
              Closest FAQs: {result.faqs.map((f) => `${f.question} (${f.score})`).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function DeleteIntentButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Trash2 className="size-4" /> Delete intent
        </Button>
      }
      title={`Delete “${title}”?`}
      description="Its keywords and course mappings are deleted too. Past conversation logs keep the intent key. To keep it for later, disable it instead."
      confirmLabel="Delete intent"
      destructive
      action={() => deleteIntentAction({ id })}
      onDone={() => router.push("/admin/advisor/intents")}
    />
  );
}
