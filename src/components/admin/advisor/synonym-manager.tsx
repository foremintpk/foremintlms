"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmAction } from "@/components/common/confirm-action";
import { useAction } from "@/hooks/use-action";
import { deleteSynonymAction, saveSynonymAction, setSynonymActiveAction } from "@/app/admin/advisor/actions";

export interface SynonymItem {
  id: string;
  term: string;
  replacement: string;
  is_active: boolean;
}

export function SynonymForm({ synonym, onDone }: { synonym?: SynonymItem; onDone?: () => void }) {
  const router = useRouter();
  const [term, setTerm] = useState(synonym?.term ?? "");
  const [replacement, setReplacement] = useState(synonym?.replacement ?? "");
  const { run, pending, fieldErrors } = useAction(saveSynonymAction, {
    onSuccess: () => {
      if (!synonym) {
        setTerm("");
        setReplacement("");
      }
      onDone?.();
      router.refresh();
    },
  });
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ id: synonym?.id, term, replacement, is_active: synonym?.is_active ?? true });
      }}
    >
      <div>
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="When visitors type… (iphone)" maxLength={80} aria-label="Term visitors type" />
        {fieldErrors.term?.[0] ? <p className="mt-1 text-xs text-destructive">{fieldErrors.term[0]}</p> : null}
      </div>
      <ArrowRight className="mt-2.5 hidden size-4 text-muted-foreground sm:block" aria-hidden />
      <div>
        <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="…treat it as (ios)" maxLength={80} aria-label="Replacement" />
        {fieldErrors.replacement?.[0] ? <p className="mt-1 text-xs text-destructive">{fieldErrors.replacement[0]}</p> : null}
      </div>
      <Button type="submit" disabled={pending || !term.trim() || !replacement.trim()}>
        {pending ? "Saving…" : synonym ? "Save" : "Add synonym"}
      </Button>
    </form>
  );
}

export function SynonymRow({ synonym }: { synonym: SynonymItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const toggle = useAction(setSynonymActiveAction, { onSuccess: () => router.refresh() });
  if (editing) {
    return (
      <li className="px-4 py-3">
        <SynonymForm synonym={synonym} onDone={() => setEditing(false)} />
        <button type="button" className="mt-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </li>
    );
  }
  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${synonym.is_active ? "" : "opacity-60"}`}>
      <p className="min-w-0 flex-1 font-mono text-sm">
        {synonym.term} <span className="text-muted-foreground">→</span> {synonym.replacement}
      </p>
      <Switch checked={synonym.is_active} disabled={toggle.pending} onCheckedChange={(v) => void toggle.run({ id: synonym.id, active: v })} aria-label={`${synonym.is_active ? "Disable" : "Enable"} ${synonym.term}`} />
      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Edit ${synonym.term}`}>
        <Pencil />
      </Button>
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${synonym.term}`}>
            <Trash2 />
          </Button>
        }
        title="Delete this synonym?"
        description={`${synonym.term} → ${synonym.replacement}`}
        confirmLabel="Delete synonym"
        destructive
        action={() => deleteSynonymAction({ id: synonym.id })}
        onDone={() => router.refresh()}
      />
    </li>
  );
}
