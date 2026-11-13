import { CookieConsent } from "@/components/site/cookie-consent";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const settings = await getPublicSettings();
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <CookieConsent gaMeasurementId={settings.gaMeasurementId} plausibleDomain={settings.plausibleDomain} />
    </div>
  );
}
