"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { isBusy, markTrigger, subscribeActivity } from "@/lib/client/activity"
import { buttonVariants } from "./button-variants"
import { Spinner } from "./spinner"

/**
 * Button with built-in busy state. It turns busy when:
 * - `loading` is set, or
 * - it was the button pressed to start a tracked action (`useAction`,
 *   `useTrackedTransition`) and that action is still running.
 * While busy it is disabled, shows a spinner in place of its icon and keeps
 * full colour, so the click visibly "took".
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  onClick,
  style,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Show the busy state (spinner, disabled) regardless of tracked actions. */
    loading?: boolean
  }) {
  const id = React.useId()
  const tracked = React.useSyncExternalStore(
    subscribeActivity,
    () => isBusy(id),
    () => false
  )
  const busy = loading || tracked

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    markTrigger(id)
    onClick?.(event)
  }

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        // The slotted element renders its own content, so it cannot show the
        // busy spinner; it does not register as an action trigger either.
        onClick={onClick}
        style={style}
        {...props}
        {...{ disabled }}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={busy ? "" : undefined}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(
        buttonVariants({ variant, size, className }),
        busy && "cursor-progress [&>svg:not([data-slot=spinner])]:hidden"
      )}
      // A busy button keeps (almost) full colour; only truly disabled ones fade.
      style={busy ? { ...style, opacity: 0.85 } : style}
      onClick={handleClick}
      {...props}
    >
      {busy ? <Spinner aria-hidden data-icon="inline-start" /> : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
