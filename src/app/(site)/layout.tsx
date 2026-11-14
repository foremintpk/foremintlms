import { CookieConsent } from "@/components/site/cookie-consent";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CartProvider } from "@/components/commerce/cart-provider";
import { AdvisorWidget } from "@/components/advisor/advisor-widget";
import { getPublicSettings } from "@/lib/settings";
import { getAdvisorConfig } from "@/lib/services/advisor/knowledge";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, advisor] = await Promise.all([getPublicSettings(), getAdvisorConfig()]);
  return (
    // One shared learning-package cart for the selector, course pages, checkout and the course advisor.
    <CartProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <SiteHeader />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        <CookieConsent gaMeasurementId={settings.gaMeasurementId} plausibleDomain={settings.plausibleDomain} />
        <AdvisorWidget
          config={{
            enabled: advisor.enabled,
            greeting: advisor.greeting,
            intro: advisor.intro,
            privacyNotice: advisor.privacy_notice,
            quickReplies: advisor.quick_replies,
            showQuickReplies: advisor.show_quick_replies,
          }}
        />
      </div>
    </CartProvider>
  );
}
