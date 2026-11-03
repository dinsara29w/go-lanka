import Link from "next/link";
import { Menu } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { CurrencySwitcher } from "@/components/currency/currency-switcher";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

const navigation = [
  { href: "/packages", label: strings.nav.packages },
  { href: "/map", label: strings.nav.map },
  { href: "/reviews", label: strings.nav.reviews },
  { href: "/photos", label: strings.nav.photos },
  { href: "/travel-info", label: strings.nav.travelInfo },
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/about", label: strings.nav.about },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-ivory/95">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-ocean text-ivory shadow-soft transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none">
            <BrandMark className="size-7" />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full ring-1 ring-inset ring-gold/50"
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-heading text-lg leading-none font-semibold tracking-tight">
              {strings.common.siteName}
            </span>
            <span className="mt-1.5 truncate text-[0.6rem] font-semibold tracking-[0.26em] text-ochre uppercase">
              Ceylon · Sri Lanka
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <CurrencySwitcher />
          <Button asChild className="h-10 rounded-full px-5">
            <Link href="/tour-builder">{strings.home.secondaryCta}</Link>
          </Button>
        </div>

        <details className="group relative lg:hidden">
          <summary
            aria-label={strings.common.menu}
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-ink/15 bg-background/70 text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </summary>
          <div className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-ink/10 bg-card p-3 text-card-foreground shadow-lift">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
              {navigation.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} mobile />
              ))}
              <div className="mt-2 border-t border-ink/10 pt-3">
                <Button asChild className="w-full rounded-full">
                  <Link href="/contact">{strings.nav.contact}</Link>
                </Button>
              </div>
              <div className="flex items-center justify-between px-3 pt-3">
                <span className="text-xs text-muted-foreground">{strings.currency.label}</span>
                <CurrencySwitcher />
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
