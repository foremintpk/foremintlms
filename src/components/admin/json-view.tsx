"use client";

import { Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Opens a dialog with pretty-printed JSON (audit metadata, raw records). */
export function JsonView({ title, data, triggerLabel = "Details" }: { title: string; data: unknown; triggerLabel?: string }) {
  const empty = data === null || data === undefined || (typeof data === "object" && Object.keys(data as object).length === 0);
  if (empty) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="xs" variant="ghost">
          <Braces /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Recorded data, shown exactly as stored.</DialogDescription>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
