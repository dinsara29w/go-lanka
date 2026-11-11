import Link from "next/link";
import { Menu } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { CurrencySwitcher } from "@/components/currency/currency-switcher";
import { NavLink } from "@/components/layout/nav-link";
import { strings } from "@/content/strings";

// Only the essentials live up here. Reviews, gallery, travel info and contact are in the footer;
// "Plan my trip" goes to the contact page, and the logo goes home.
const navigation = [
  { href: "/packages", label: strings.nav.packages },
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/map", label: strings.nav.map },
  { href: "/about", label: strings.nav.about },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-page/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-[75rem] items-center justify-between gap-5 px-4 sm:px-6">
        <Logo size={48} />

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 text-base font-semibold lg:flex"
        >
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <CurrencySwitcher />
          <Link href="/contact" className="btn-gold btn-sm">
            {strings.site.planTrip}
          </Link>
        </div>

        <details className="group relative lg:hidden">
          <summary
            aria-label={strings.common.menu}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors hover:bg-band [&::-webkit-details-marker]:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </summary>
          <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-3 shadow-lift">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
              {navigation.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} mobile />
              ))}
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-1 pt-3">
                <CurrencySwitcher />
                <Link href="/contact" className="btn-gold btn-sm">
                  {strings.site.planTrip}
                </Link>
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
