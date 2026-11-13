import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getPublicSettings } from "@/lib/settings";
import { CookiePreferencesButton } from "./cookie-consent";
import { CopyrightYear } from "./copyright-year";
import { NewsletterForm } from "./forms";
import { Container } from "./primitives";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "All courses" },
      { href: "/programs", label: "Learning programs" },
      { href: "/instructors", label: "Instructors" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/case-studies", label: "Case studies" },
      { href: "/success-stories", label: "Success stories" },
      { href: "/faq", label: "FAQ" },
      { href: "/certificates/verify", label: "Verify a certificate" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/testimonials", label: "Testimonials" },
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Student login" },
    ],
  },
];

const LEGAL = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refund", label: "Refunds" },
  { href: "/legal/cookies", label: "Cookies" },
];

const SOCIAL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  twitter: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export async function SiteFooter() {
  const settings = await getPublicSettings();
  const social = Object.entries(settings.socialLinks).filter(([, url]) => typeof url === "string" && /^https:\/\//.test(url));
  return (
    <footer className="mt-auto border-t bg-card">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              Practical education for people building businesses, launching digital careers and creating opportunities online.
            </p>
            <div className="mt-6">
              <p className="mb-3 text-sm font-semibold">Get new courses and guides by email</p>
              <NewsletterForm source="footer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="text-sm font-semibold">{col.title}</p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            {settings.supportEmail || settings.phone || social.length ? (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-sm font-semibold">Get in touch</p>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {settings.supportEmail ? (
                    <li>
                      <a href={`mailto:${settings.supportEmail}`} className="hover:text-foreground">
                        {settings.supportEmail}
                      </a>
                    </li>
                  ) : null}
                  {settings.phone ? (
                    <li>
                      <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`} className="hover:text-foreground">
                        {settings.phone}
                      </a>
                    </li>
                  ) : null}
                  {social.map(([key, url]) => (
                    <li key={key}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                        {SOCIAL_LABELS[key.toLowerCase()] ?? key}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © <CopyrightYear /> {settings.legalEntityName || settings.brandName}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <CookiePreferencesButton className="hover:text-foreground" />
            </li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
