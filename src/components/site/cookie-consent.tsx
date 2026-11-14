"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * Cookie consent. Strictly necessary cookies are always on; analytics only
 * load after an explicit opt-in. The choice is stored in a first-party
 * cookie for 180 days and can be changed from the footer at any time.
 */

const COOKIE = "fm_consent";
const MAX_AGE = 60 * 60 * 24 * 180;
export const OPEN_PREFERENCES_EVENT = "fm:open-cookie-preferences";

interface Consent {
  v: 1;
  analytics: boolean;
  ts: number;
}

function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))) as Consent;
    return parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(analytics: boolean) {
  const value = encodeURIComponent(JSON.stringify({ v: 1, analytics, ts: Date.now() } satisfies Consent));
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("fm:consent-changed"));
}

function subscribe(callback: () => void) {
  window.addEventListener("fm:consent-changed", callback);
  return () => window.removeEventListener("fm:consent-changed", callback);
}

function useConsent() {
  // Serialise for a stable snapshot; parse on read.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const c = readConsent();
      return c ? `${c.analytics ? 1 : 0}` : "none";
    },
    () => "pending",
  );
  return snapshot as "pending" | "none" | "0" | "1";
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}>
      Cookie preferences
    </button>
  );
}

export function CookieConsent({ gaMeasurementId, plausibleDomain }: { gaMeasurementId: string; plausibleDomain: string }) {
  const consent = useConsent();
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const openPreferences = useCallback(() => {
    setAnalytics(readConsent()?.analytics ?? false);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_PREFERENCES_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, openPreferences);
  }, [openPreferences]);

  const hasAnalyticsTools = Boolean(gaMeasurementId || plausibleDomain);
  const analyticsAllowed = consent === "1";
  const gaId = /^G-[A-Z0-9]{4,}$/.test(gaMeasurementId) ? gaMeasurementId : "";
  const plausible = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(plausibleDomain) ? plausibleDomain : "";

  return (
    <>
      {analyticsAllowed && gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
      {analyticsAllowed && plausible ? (
        <Script src="https://plausible.io/js/script.js" data-domain={plausible} strategy="afterInteractive" />
      ) : null}

      {consent === "none" ? (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border bg-popover p-4 text-sm shadow-raised sm:inset-x-6 sm:bottom-6 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-muted-foreground">
              We use essential cookies to keep you signed in and the site secure.
              {hasAnalyticsTools ? " With your permission we'd also like to use analytics to improve the site." : ""}{" "}
              <Link href="/legal/cookies" className="font-medium text-foreground underline underline-offset-2">
                Cookie policy
              </Link>
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" className="h-10" onClick={openPreferences}>
                Preferences
              </Button>
              {hasAnalyticsTools ? (
                <>
                  <Button variant="outline" className="h-10" onClick={() => writeConsent(false)}>
                    Essential only
                  </Button>
                  <Button className="h-10" onClick={() => writeConsent(true)}>
                    Accept analytics
                  </Button>
                </>
              ) : (
                <Button className="h-10" onClick={() => writeConsent(false)}>
                  Got it
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>Choose which cookies Foremint Academy may use on this device.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-semibold">Strictly necessary</p>
                <p className="mt-1 text-sm text-muted-foreground">Sign-in, security and remembering these choices. Always on.</p>
              </div>
              <Switch checked disabled aria-label="Strictly necessary cookies (always on)" />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div>
                <Label htmlFor="consent-analytics" className="text-sm font-semibold">
                  Analytics
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasAnalyticsTools
                    ? "Anonymous statistics about which pages are used, so we can improve the site."
                    : "No analytics tools are currently enabled on this site."}
                </p>
              </div>
              <Switch id="consent-analytics" checked={analytics} onCheckedChange={setAnalytics} disabled={!hasAnalyticsTools} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="rounded-xl"
              onClick={() => {
                const hadAnalytics = readConsent()?.analytics ?? false;
                writeConsent(analytics);
                setOpen(false);
                // Already-loaded analytics scripts can only be removed by a reload.
                if (hadAnalytics && !analytics) window.location.reload();
              }}
            >
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
