"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction, type ClientActionResult } from "@/hooks/use-action";

export function ProductSettingsForm({
  product,
  save,
}: {
  product: { id: string; name: string; description: string | null; status: "active" | "archived"; is_featured: boolean };
  save: (input: { productId: string; name: string; description: string | null; status: "active" | "archived"; is_featured: boolean }) => Promise<ClientActionResult<unknown>>;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [status, setStatus] = useState(product.status);
  const [featured, setFeatured] = useState(product.is_featured);
  const { run, pending, fieldErrors } = useAction(save, { onSuccess: () => router.refresh() });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ productId: product.id, name, description: description.trim() || null, status, is_featured: featured });
      }}
    >
      <Field>
        <FieldLabel htmlFor="product-name">Name</FieldLabel>
        <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        <FieldDescription>Shown at checkout and on receipts.</FieldDescription>
        {fieldErrors.name?.[0] ? <FieldError>{fieldErrors.name[0]}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="product-description">Description</FieldLabel>
        <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="product-status">Status</FieldLabel>
          <Select value={status} onValueChange={(v) => setStatus(v as "active" | "archived")}>
            <SelectTrigger id="product-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active — can be sold</SelectItem>
              <SelectItem value="archived">Archived — not for sale</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 sm:mt-6">
          <span className="text-sm font-medium">Feature on pricing page</span>
          <Switch checked={featured} onCheckedChange={setFeatured} aria-label="Feature on pricing page" />
        </label>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </Button>
      </div>
    </form>
  );
}
