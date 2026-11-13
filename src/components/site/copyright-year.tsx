"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The current year, computed in the browser so prerendered HTML stays static. */
export function CopyrightYear() {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => null,
  );
  return <span suppressHydrationWarning>{year ?? ""}</span>;
}
