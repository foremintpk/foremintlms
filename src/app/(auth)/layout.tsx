import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Calm, two-column auth shell: the form on the left, a photographic brand
 * panel on large screens. No session reads here — pages handle that.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Foremint Academy home">
            <Logo markClassName="size-7" />
          </Link>
          <Link href="/courses" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Browse courses
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-10">{children}</main>
        <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden>
        <Image
          src="/images/about/global-community.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#15122e] via-[#15122e]/55 to-[#15122e]/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 xl:p-16">
          <p className="max-w-md font-heading text-[2.25rem] leading-[1.1] font-semibold tracking-tight text-white">
            Practical skills for people building what&rsquo;s next.
          </p>
          <ul className="mt-6 grid max-w-md gap-2.5 text-[0.95rem] text-white/80">
            <li className="flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-mint" /> Learn at your own pace, on any device
            </li>
            <li className="flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-mint" /> Live workshops and instructor feedback
            </li>
            <li className="flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-mint" /> Verifiable certificates when you finish
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
