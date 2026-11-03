import Link from "next/link";
import { Menu } from "lucide-react";

import { CurrencySwitcher } from "@/components/currency/currency-switcher";
import { NavLink } from "@/components/layout/nav-link";
import { Wordmark } from "@/components/layout/wordmark";
import { strings } from "@/content/strings";

const navigation = [
  { href: "/", label: strings.nav.home },
  { href: "/about", label: strings.nav.about },
  { href: "/map", label: strings.nav.map },
  { href: "/packages", label: strings.nav.packages },
  { href: "/reviews", label: strings.nav.reviews },
  { href: "/photos", label: strings.nav.photos },
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/contact", label: strings.nav.contact },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/[0.96] backdrop-blur-sm">
      <div className="mx-auto flex h-[3.75rem] max-w-[73.75rem] items-center justify-between gap-6 px-4 sm:px-6 xl:px-0">
        <Wordmark />

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-5 text-sm font-medium lg:flex xl:gap-6"
        >
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="hidden items-center gap-3.5 lg:flex">
          <CurrencySwitcher />
          <Link href="/contact" className="btn-pill btn-pill-sm">
            {strings.site.planTrip}
          </Link>
        </div>

        <details className="group relative lg:hidden">
          <summary
            aria-label={strings.common.menu}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-band [&::-webkit-details-marker]:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </summary>
          <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-3 shadow-lift">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
              {navigation.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} mobile />
              ))}
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-1 pt-3">
                <CurrencySwitcher />
                <Link href="/contact" className="btn-pill btn-pill-sm">
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
