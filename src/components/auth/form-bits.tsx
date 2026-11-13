"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { passwordStrength } from "./utils";

/** Label + control + description/error, wired for screen readers. */
export function FormField({
  label,
  htmlFor,
  description,
  error,
  children,
  action,
  className,
}: {
  label: string;
  htmlFor: string;
  description?: React.ReactNode;
  error?: string[] | string | null;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {message ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : description ? (
        <p id={`${htmlFor}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  invalid,
  placeholder,
  required = true,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="h-11 pr-11 text-base sm:text-sm"
        maxLength={128}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const BAR_COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-mint", "bg-mint-strong"];

export function PasswordStrengthMeter({ password, context = [] }: { password: string; context?: string[] }) {
  const id = useId();
  if (!password) return null;
  const strength = passwordStrength(password, context);
  return (
    <div className="grid gap-1.5" aria-live="polite" id={id}>
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", i < strength.score && BAR_COLORS[strength.score])}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{strength.label}</span>
        {strength.hints[0] ? ` · ${strength.hints[0]}` : null}
      </p>
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-3.5 py-3 text-sm",
        tone === "error" && "border-destructive/25 bg-destructive/5 text-destructive",
        tone === "success" && "border-success/25 bg-success-soft text-success",
        tone === "info" && "border-info/25 bg-info-soft text-info",
      )}
    >
      {children}
    </div>
  );
}
