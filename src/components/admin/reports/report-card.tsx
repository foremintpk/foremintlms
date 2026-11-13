"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ReportCard({ reportKey, label, description, dated }: { reportKey: string; label: string; description: string; dated: boolean }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = Boolean(from && to && to < from);
  const params = new URLSearchParams();
  if (dated && from) params.set("from", from);
  if (dated && to) params.set("to", to);
  const href = `/api/exports/${reportKey}${params.size ? `?${params}` : ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground" /> {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {dated ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Includes all records.</p>
        )}
        {invalid ? <p className="text-xs text-destructive">The end date is before the start date.</p> : null}
        <Button asChild={!invalid} variant="outline" disabled={invalid}>
          {invalid ? (
            <span>
              <Download /> Download CSV
            </span>
          ) : (
            <a href={href} download>
              <Download /> Download CSV
            </a>
          )}
        </Button>
        {dated ? <p className="text-xs text-muted-foreground">Leave the dates empty to export everything.</p> : null}
      </CardContent>
    </Card>
  );
}
