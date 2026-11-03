import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { strings } from "@/content/strings";
import type { SiteSettings } from "@/server/repositories/site-settings";

const exploreLinks = [
  { href: "/packages", label: strings.nav.packages },
  { href: "/map", label: strings.nav.map },
  { href: "/travel-info", label: strings.nav.travelInfo },
  { href: "/reviews", label: strings.nav.reviews },
  { href: "/photos", label: strings.nav.photos },
];

const companyLinks = [
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/about", label: strings.nav.about },
  { href: "/contact", label: strings.nav.contact },
  { href: "/privacy", label: strings.footer.privacy },
  { href: "/terms", label: strings.footer.terms },
];

export function SiteFooter({ settings }: { settings: SiteSettings | null }) {
  const socials = Object.entries(settings?.socials ?? {});

  return (
    <footer className="relative overflow-hidden bg-ocean-deep text-ivory/75">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-6rem] size-[26rem] rounded-full border border-gold/15" />
        <div className="absolute -top-20 right-[-2rem] size-[18rem] rounded-full border border-gold/15" />
        <div className="absolute -bottom-40 left-[-10rem] size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(201,150,43,0.12),transparent_65%)]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div className="space-y-5 md:col-span-2 lg:col-span-1 lg:pr-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          >
            <span className="relative flex size-11 items-center justify-center rounded-full bg-ivory text-ocean">
              <BrandMark className="size-7" />
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full ring-1 ring-inset ring-gold/60"
              />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-lg leading-none font-semibold text-ivory">
                {strings.common.siteName}
              </span>
              <span className="mt-1.5 text-[0.6rem] font-semibold tracking-[0.26em] text-gold-light uppercase">
                Ceylon · Sri Lanka
              </span>
            </span>
          </Link>
          <p className="max-w-sm text-sm leading-6">{strings.home.description}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-[0.65rem] font-semibold tracking-[0.24em] text-gold-light uppercase">
            {strings.footer.exploreHeading}
          </h2>
          <nav aria-label="Footer explore" className="flex flex-col gap-2.5 text-sm">
            {exploreLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-fit text-ivory/70 transition-colors hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          <h2 className="text-[0.65rem] font-semibold tracking-[0.24em] text-gold-light uppercase">
            {strings.footer.companyHeading}
          </h2>
          <nav aria-label="Footer company" className="flex flex-col gap-2.5 text-sm">
            {companyLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="w-fit text-ivory/70 transition-colors hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-4">
          <h2 className="text-[0.65rem] font-semibold tracking-[0.24em] text-gold-light uppercase">
            {strings.footer.contactHeading}
          </h2>
          <div className="flex flex-col gap-2.5 text-sm">
            {settings?.contactEmail ? (
              <a
                href={`mailto:${settings.contactEmail}`}
                className="w-fit break-all text-ivory/70 transition-colors hover:text-ivory"
              >
                {settings.contactEmail}
              </a>
            ) : null}
            {settings?.phone ? (
              <a
                href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                className="w-fit text-ivory/70 transition-colors hover:text-ivory"
              >
                {settings.phone}
              </a>
            ) : null}
            {settings?.whatsappNumber ? (
              <a
                href={`https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="w-fit text-ivory/70 transition-colors hover:text-ivory"
              >
                {strings.whatsapp.label}
              </a>
            ) : null}
            {!settings?.contactEmail && !settings?.phone && !settings?.whatsappNumber ? (
              <Link
                href="/contact"
                className="w-fit text-ivory/70 underline-offset-4 transition-colors hover:text-ivory hover:underline"
              >
                {strings.contact.heading}
              </Link>
            ) : null}
            {socials.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
                {socials.map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ivory/60 underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative border-t border-ivory/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ivory/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {strings.common.siteName}. {strings.footer.copyright}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-ivory">
              {strings.footer.privacy}
            </Link>
            <span aria-hidden="true" className="size-1 rounded-full bg-gold/60" />
            <Link href="/terms" className="transition-colors hover:text-ivory">
              {strings.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
