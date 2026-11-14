"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Check, ChevronDown, Loader2, Plus, RotateCcw, Send, TicketPercent, X } from "lucide-react";
import { AdvisorAvatar } from "./advisor-avatar";
import { MediaImage } from "@/components/site/primitives";
import { useCart } from "@/components/commerce/cart-provider";
import { CartTotals } from "@/components/commerce/cart-summary";
import { PaymentLinkActions } from "@/components/commerce/copy-share";
import { formatMinor } from "@/lib/domain/invoicing";
import type { AdvisorBlock, AdvisorCourseCard, AdvisorOption, AdvisorPublicConfig, AdvisorReply, AdvisorRequest } from "@/lib/domain/advisor-view";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Entry {
  id: string;
  role: "assistant" | "user";
  text?: string;
  blocks?: AdvisorBlock[];
}

const STORAGE_KEY = "fm-advisor-transcript-v1";
const MAX_ENTRIES = 60;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function welcome(config: AdvisorPublicConfig): Entry {
  const blocks: AdvisorBlock[] = [{ type: "text", text: [config.greeting, config.intro].filter(Boolean).join("\n\n") }];
  if (config.showQuickReplies && config.quickReplies.length) blocks.push({ type: "options", options: config.quickReplies.map((q) => ({ label: q, message: q })) });
  return { id: "welcome", role: "assistant", blocks };
}

function loadTranscript(config: AdvisorPublicConfig): Entry[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Entry[]) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return [welcome(config)];
}

async function callAdvisor(body: AdvisorRequest): Promise<AdvisorReply | { error: string }> {
  try {
    const res = await fetch("/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const json = (await res.json().catch(() => null)) as (AdvisorReply & { error?: string }) | null;
    if (!res.ok || !json || !Array.isArray(json.blocks)) return { error: json?.error ?? "Something went wrong. Try again in a moment." };
    return json;
  } catch {
    return { error: "I couldn't reach the server. Check your connection and try again." };
  }
}

/**
 * The course advisor conversation. Rule-based: every reply comes from the
 * server, assembled from admin-approved rules, the live catalog and FAQs.
 */
export function AdvisorPanel({
  config,
  open,
  onMinimize,
  pendingMessage,
  onPendingConsumed,
}: {
  config: AdvisorPublicConfig;
  open: boolean;
  onMinimize: () => void;
  pendingMessage: string | null;
  onPendingConsumed: () => void;
}) {
  const cart = useCart();
  const [entries, setEntries] = useState<Entry[]>(() => loadTranscript(config));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch {
      /* storage full or unavailable */
    }
  }, [entries]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMinimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onMinimize]);

  const send = useCallback(
    async (body: AdvisorRequest, userText?: string) => {
      if (userText) setEntries((e) => [...e, { id: uid(), role: "user", text: userText }]);
      setBusy(true);
      const reply = await callAdvisor(body);
      setBusy(false);
      if ("error" in reply) {
        setEntries((e) => [...e, { id: uid(), role: "assistant", blocks: [{ type: "notice", tone: "error", text: reply.error }] }]);
        return;
      }
      cart.replace(reply.cart);
      if (reply.blocks.length) setEntries((e) => [...e, { id: uid(), role: "assistant", blocks: reply.blocks }]);
    },
    [cart],
  );

  // A message handed over by "Ask the course advisor" buttons elsewhere on the page.
  const handledPending = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingMessage) {
      handledPending.current = null;
      return;
    }
    if (!open || handledPending.current === pendingMessage) return;
    handledPending.current = pendingMessage;
    const text = pendingMessage;
    onPendingConsumed();
    window.setTimeout(() => void send({ type: "message", text }, text), 0);
  }, [open, pendingMessage, onPendingConsumed, send]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send({ type: "message", text: text.slice(0, 500) }, text);
  }

  function chooseOption(opt: AdvisorOption) {
    if (busy) return;
    if (opt.action === "checkout") {
      void callAdvisor({ type: "checkout_opened" });
      window.location.assign("/checkout");
      return;
    }
    if (opt.action === "view_cart") return void send({ type: "view_cart" }, opt.label);
    if (opt.action === "coupon") return void send({ type: "coupon" }, opt.label);
    if (opt.action === "request_link") return void send({ type: "request_link" }, opt.label);
    if (opt.intent) return void send({ type: "option", intent: opt.intent, label: opt.label }, opt.label);
    if (opt.message) return void send({ type: "message", text: opt.message }, opt.message);
  }

  function restart() {
    setEntries([welcome(config)]);
    void callAdvisor({ type: "reset" });
  }

  const lastAssistant = [...entries].reverse().find((e) => e.role === "assistant")?.id;

  return (
    <div
      id="course-advisor-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="advisor-title"
      hidden={!open}
      className={cn(
        "fixed z-[45] flex-col overflow-hidden border bg-card shadow-raised",
        "inset-0 sm:inset-auto sm:bottom-6 sm:left-6 sm:h-[min(660px,calc(100svh-3rem))] sm:w-[400px] sm:rounded-3xl",
        open ? "flex animate-rise" : "hidden",
      )}
      data-testid="advisor-panel"
    >
      <header className="flex shrink-0 items-center gap-3 border-b bg-[linear-gradient(180deg,var(--brand-soft),transparent)] px-4 py-3">
        <AdvisorAvatar size="sm" />
        <div className="min-w-0 flex-1">
          <h2 id="advisor-title" className="flex items-center gap-2 font-heading text-[0.95rem] font-semibold">
            Course advisor
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold tracking-wide text-primary-foreground">
              <Bot className="size-3" aria-hidden /> Chatbot
            </span>
          </h2>
          <p className="truncate text-xs text-muted-foreground">Automated assistant · instant answers</p>
        </div>
        <button type="button" onClick={restart} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Start over" title="Start over">
          <RotateCcw className="size-4" />
        </button>
        <button type="button" onClick={onMinimize} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Minimise the course advisor" title="Minimise">
          <ChevronDown className="size-5" />
        </button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-busy={busy} data-testid="advisor-messages">
        {entries.map((entry) =>
          entry.role === "user" ? (
            <div key={entry.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground" data-testid="advisor-user-message">
                {entry.text}
              </p>
            </div>
          ) : (
            <div key={entry.id} className="grid max-w-[95%] gap-2.5" data-testid="advisor-reply">
              {(entry.blocks ?? []).map((block, i) => (
                <BlockView key={i} block={block} live={entry.id === lastAssistant} busy={busy} onOption={chooseOption} send={send} />
              ))}
            </div>
          ),
        )}
        {busy ? (
          <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3" aria-label="The advisor is replying">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t bg-card p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="advisor-input" className="sr-only">
            Your message
          </label>
          <input
            ref={inputRef}
            id="advisor-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            autoComplete="off"
            placeholder="Type your goal or question…"
            className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 sm:text-sm"
            data-testid="advisor-input"
          />
          <button type="submit" disabled={busy || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-brand-strong disabled:opacity-40" aria-label="Send" data-testid="advisor-send">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        {config.privacyNotice ? <p className="mt-2 text-[0.7rem] leading-snug text-muted-foreground">{config.privacyNotice}</p> : null}
      </form>
    </div>
  );
}

function Bubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm whitespace-pre-line", className)}>{children}</div>;
}

function BlockView({
  block,
  live,
  busy,
  onOption,
  send,
}: {
  block: AdvisorBlock;
  live: boolean;
  busy: boolean;
  onOption: (o: AdvisorOption) => void;
  send: (body: AdvisorRequest, userText?: string) => Promise<void>;
}) {
  switch (block.type) {
    case "text":
      return <Bubble>{block.text}</Bubble>;
    case "notice":
      return <Bubble className={block.tone === "error" ? "border border-destructive/30 bg-destructive/5" : "border border-info/20 bg-info-soft"}>{block.text}</Bubble>;
    case "faq":
      return (
        <Bubble>
          <p className="font-semibold">{block.question}</p>
          <p className="mt-1 text-foreground/80">{block.answer}</p>
        </Bubble>
      );
    case "options":
      return (
        <div className="grid gap-2">
          {block.question ? <Bubble>{block.question}</Bubble> : null}
          <div className="flex flex-wrap gap-2" role="group" aria-label={block.question ?? "Suggestions"}>
            {block.options.map((o) => (
              <button
                key={`${o.label}-${o.intent ?? o.action ?? ""}`}
                type="button"
                disabled={!live || busy}
                onClick={() => onOption(o)}
                className="rounded-full border border-primary/25 bg-background px-3 py-1.5 text-left text-[0.8rem] font-medium text-primary transition-colors hover:border-primary hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-50"
                data-testid="advisor-option"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    case "courses":
      return <CourseCards courses={block.courses} send={send} busy={busy} />;
    case "cart":
      return <ChatCart onOption={onOption} live={live} busy={busy} />;
    case "checkout_cta":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/checkout"
            onClick={() => void fetch("/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "checkout_opened" }) })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong"
          >
            Proceed to checkout <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button type="button" disabled={!live || busy} onClick={() => onOption({ label: "Get a payment link", action: "request_link" })} className="h-10 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            Get a payment link
          </button>
        </div>
      );
    case "email_request":
      return live ? <EmailForm suggested={block.suggested} send={send} busy={busy} /> : null;
    case "coupon_request":
      return live ? <CouponForm send={send} busy={busy} /> : null;
    case "payment_link":
      return (
        <div className="rounded-2xl border border-mint-strong/30 bg-mint-soft/50 p-3.5 text-sm" data-testid="advisor-payment-link">
          <p className="font-semibold">
            Order {block.orderNumber} · {formatMinor(block.totalMinor, block.currency)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            For {block.email}
            {block.free ? "" : ` · link works until ${formatDateTime(block.expiresAt)} UTC`}
          </p>
          {block.paymentUrl ? (
            <>
              <PaymentLinkActions url={block.paymentUrl} title={`Foremint Academy order ${block.orderNumber}`} className="mt-3" compact />
              <p className="mt-2 text-xs text-muted-foreground">Copy the link and share it with your parent, institution or whoever will complete your payment.</p>
            </>
          ) : null}
          <Link href={block.statusUrl} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
            Track this order
          </Link>
        </div>
      );
  }
}

function CourseCards({ courses, send, busy }: { courses: AdvisorCourseCard[]; send: (body: AdvisorRequest, userText?: string) => Promise<void>; busy: boolean }) {
  const cart = useCart();
  const missing = courses.filter((c) => !cart.has(c.id) && c.priceMinor !== null);
  return (
    <div className="grid gap-2" data-testid="advisor-courses">
      {courses.map((c) => {
        const inCart = cart.has(c.id);
        return (
          <div key={c.id} className="flex gap-3 rounded-2xl border bg-background p-2.5" data-testid="advisor-course" data-course-id={c.id}>
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
              <MediaImage src={c.thumbnailUrl} alt="" sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              {c.category ? <p className="truncate text-[0.7rem] font-medium text-primary">{c.category}</p> : null}
              <Link href={`/courses/${c.slug}`} className="line-clamp-2 text-sm leading-snug font-semibold hover:underline">
                {c.title}
              </Link>
              {c.explanation ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.explanation}</p> : null}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs">
                  {c.priceMinor !== null ? (
                    <>
                      <span className="font-semibold text-foreground tabular-nums" data-testid="advisor-course-price">
                        {formatMinor(c.priceMinor, c.currency)}
                      </span>
                      {c.accessLabel ? <span className="text-muted-foreground"> · {c.accessLabel}</span> : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not offered for this access period</span>
                  )}
                </p>
                {c.priceMinor !== null ? (
                  <button
                    type="button"
                    disabled={busy || cart.pendingIds.has(c.id)}
                    onClick={() => void (inCart ? cart.remove(c.id, { silent: true }) : send({ type: "add", courseIds: [c.id] }, `Add ${c.title}`))}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                      inCart ? "bg-brand-soft text-primary" : "bg-primary text-primary-foreground hover:bg-brand-strong",
                    )}
                    aria-pressed={inCart}
                    data-testid="advisor-add-course"
                  >
                    {inCart ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                    {inCart ? "Added" : "Add"}
                    <span className="sr-only"> {c.title}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      {missing.length >= 2 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send({ type: "add", courseIds: missing.map((c) => c.id) }, missing.length === 2 ? "Add both" : `Add all ${missing.length}`)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-primary/30 bg-brand-soft/60 text-sm font-semibold text-primary hover:border-primary disabled:opacity-50"
          data-testid="advisor-add-all"
        >
          <Plus className="size-4" aria-hidden /> {missing.length === 2 ? "Add both" : `Add all ${missing.length}`}
        </button>
      ) : null}
    </div>
  );
}

function ChatCart({ onOption, live, busy }: { onOption: (o: AdvisorOption) => void; live: boolean; busy: boolean }) {
  const { cart, remove, pendingIds } = useCart();
  if (!cart || cart.lines.length + cart.unavailable.length === 0) return <Bubble>Your learning package is empty.</Bubble>;
  return (
    <div className="rounded-2xl border bg-background p-3.5" data-testid="advisor-cart">
      <p className="text-sm font-semibold">
        {cart.lines.length} selected {cart.lines.length === 1 ? "course" : "courses"}
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-1.5">
        {cart.lines.map((l) => (
          <li key={l.courseId} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{l.title}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">{formatMinor(l.priceMinor, cart.currency)}</span>
            <button type="button" onClick={() => void remove(l.courseId, { silent: true })} disabled={pendingIds.has(l.courseId)} aria-label={`Remove ${l.title}`} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted">
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {cart.unavailable.map((u) => (
          <li key={u.courseId} className="rounded-lg bg-warning-soft px-2 py-1 text-xs">
            {u.message}
          </li>
        ))}
      </ul>
      <CartTotals cart={cart} className="mt-3" />
      {live ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!cart.coupon?.applied ? (
            <button type="button" disabled={busy} onClick={() => onOption({ label: "I have a coupon code", action: "coupon" })} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border text-xs font-semibold hover:bg-muted disabled:opacity-50">
              <TicketPercent className="size-3.5" aria-hidden /> Apply coupon
            </button>
          ) : null}
          <button type="button" disabled={busy || !cart.canCheckout} onClick={() => onOption({ label: "Get a payment link", action: "request_link" })} className="h-9 rounded-lg border text-xs font-semibold hover:bg-muted disabled:opacity-50">
            Get payment link
          </button>
          <Link href="/checkout" className={cn("col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-brand-strong", !cart.canCheckout && "pointer-events-none opacity-50")}>
            Proceed to checkout <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function EmailForm({ suggested, send, busy }: { suggested: string | null; send: (body: AdvisorRequest, userText?: string) => Promise<void>; busy: boolean }) {
  const [email, setEmail] = useState(suggested ?? "");
  return (
    <form
      className="grid gap-2 rounded-2xl border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) void send({ type: "email", email: email.trim() }, email.trim());
      }}
    >
      <label htmlFor="advisor-email" className="text-xs font-semibold">
        Student email address
      </label>
      <input
        id="advisor-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className="h-10 rounded-lg border bg-card px-3 text-base sm:text-sm"
        data-testid="advisor-email"
      />
      <button type="submit" disabled={busy || !email.trim()} className="h-10 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-50" data-testid="advisor-create-link">
        Create my payment link
      </button>
      <p className="text-[0.7rem] text-muted-foreground">The courses go to this email. Whoever pays can use their own details.</p>
    </form>
  );
}

function CouponForm({ send, busy }: { send: (body: AdvisorRequest, userText?: string) => Promise<void>; busy: boolean }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = code.trim().toUpperCase();
        if (/^[A-Z0-9_-]{3,40}$/.test(value)) void send({ type: "coupon", code: value }, value);
      }}
    >
      <label htmlFor="advisor-coupon" className="sr-only">
        Coupon code
      </label>
      <input id="advisor-coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={40} placeholder="Coupon code" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-base uppercase sm:text-sm" data-testid="advisor-coupon" />
      <button type="submit" disabled={busy || code.trim().length < 3} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-strong disabled:opacity-50" data-testid="advisor-apply-coupon">
        Apply
      </button>
    </form>
  );
}
