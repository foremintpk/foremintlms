"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/common/status-badge";
import { LocalTime } from "@/components/common/local-time";
import { CopyField } from "@/components/admin/copy-button";
import { useAction } from "@/hooks/use-action";
import type { ProviderState } from "@/lib/services/admin/integrations-admin";
import { saveIntegration, testIntegration } from "@/app/admin/integrations/actions";

const STATUS_LABEL: Record<ProviderState["status"], string> = {
  not_configured: "Not connected",
  configured: "Credentials saved",
  connected: "Connected",
  error: "Connection failed",
};

export function IntegrationCard({ provider }: { provider: ProviderState }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(provider.fields.map((f) => [f.key, f.editableValue])),
  );
  const [clear, setClear] = useState<string[]>([]);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const save = useAction(saveIntegration, {
    onSuccess: () => {
      setClear([]);
      setValues(Object.fromEntries(provider.fields.map((f) => [f.key, f.secret ? "" : values[f.key] ?? ""])));
      router.refresh();
    },
  });
  const tester = useAction(testIntegration, {
    silent: true,
    onSuccess: (r) => {
      setTest(r);
      router.refresh();
    },
  });

  return (
    <Card id={provider.id}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="size-4 text-muted-foreground" /> {provider.name}
          </CardTitle>
          <CardDescription>{provider.purpose}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={provider.status}
            label={STATUS_LABEL[provider.status]}
            tone={provider.status === "connected" ? "success" : provider.status === "error" ? "danger" : provider.status === "configured" ? "info" : "neutral"}
          />
          {provider.lastCheckedAt ? (
            <span className="text-xs text-muted-foreground">
              Tested <LocalTime value={provider.lastCheckedAt} format="relative" />
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {provider.missingRequired.length ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Needed before this works: {provider.missingRequired.join(", ")}. Features that depend on {provider.name} show a “not connected” message until then.
          </p>
        ) : null}
        {provider.lastError && provider.status === "error" ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Last test: {provider.lastError}</p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run({ provider: provider.id, values, clear });
          }}
        >
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            {provider.fields.map((f) => {
              const id = `${provider.id}-${f.key}`;
              const fromEnv = f.source === "env";
              const note = fromEnv
                ? `Set by environment variable ${f.envVar}${f.secret ? ` (${f.display})` : ""}. Change it in your hosting settings.`
                : f.secret && f.source === "admin"
                  ? `Saved (${f.display}). Leave blank to keep it.`
                  : f.help;
              if (f.kind === "boolean") {
                return (
                  <Field key={f.key} orientation="horizontal" className="md:col-span-2">
                    <Switch id={id} checked={values[f.key] !== "false"} onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: String(v) }))} />
                    <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                  </Field>
                );
              }
              return (
                <Field key={f.key} className={f.kind === "textarea" ? "md:col-span-2" : undefined}>
                  <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                  {f.kind === "select" ? (
                    <Select value={values[f.key] || f.options?.[0]?.value} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} disabled={fromEnv}>
                      <SelectTrigger id={id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.kind === "textarea" ? (
                    <Textarea
                      id={id}
                      rows={3}
                      value={values[f.key] ?? ""}
                      placeholder={fromEnv ? "Set in environment" : f.secret && f.source === "admin" ? "•••••••• (saved)" : f.placeholder}
                      disabled={fromEnv}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="font-mono text-xs"
                    />
                  ) : (
                    <Input
                      id={id}
                      type={f.secret ? "password" : "text"}
                      value={fromEnv && !f.secret ? f.display : values[f.key] ?? ""}
                      placeholder={fromEnv ? "Set in environment" : f.secret && f.source === "admin" ? "•••••••• (saved)" : f.placeholder}
                      disabled={fromEnv}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  )}
                  {note ? <FieldDescription>{note}</FieldDescription> : null}
                  {f.source === "admin" && !fromEnv && f.kind !== "select" ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={clear.includes(f.key)}
                        onCheckedChange={(v) => setClear((c) => (v ? [...c, f.key] : c.filter((k) => k !== f.key)))}
                      />
                      Remove saved value
                    </label>
                  ) : null}
                </Field>
              );
            })}
          </FieldGroup>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={save.pending}>
              {save.pending ? "Saving…" : "Save settings"}
            </Button>
            <Button type="button" variant="outline" disabled={tester.pending} onClick={() => void tester.run({ provider: provider.id })}>
              {tester.pending ? "Testing…" : "Test connection"}
            </Button>
            {test ? (
              <span className={`inline-flex items-center gap-1.5 text-sm ${test.ok ? "text-success" : "text-destructive"}`} role="status">
                {test.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {test.message}
              </span>
            ) : null}
          </div>
        </form>

        {provider.urls.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {provider.urls.map((u) => (
              <CopyField key={u.label} label={u.label} value={u.url} />
            ))}
          </div>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="link" className="h-auto w-fit p-0">
              How to set up {provider.name}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {provider.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
