import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { CompassWatermark } from "@/components/brand/compass";
import { strings } from "@/content/strings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { SiteSettings } from "@/server/repositories/site-settings";

const exploreLinks = [
  { href: "/packages", label: strings.site.tourPackages },
  { href: "/map", label: strings.site.destinations },
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/photos", label: strings.nav.photos },
];

const companyLinks = [
  { href: "/about", label: strings.nav.about },
  { href: "/contact", label: strings.site.enquire },
  { href: "/reviews", label: strings.nav.reviews },
  { href: "/travel-info", label: strings.nav.travelInfo },
];

const headingClass = "mb-1 font-heading text-base font-semibold text-white";
const linkClass = "w-fit text-white/70 transition-colors hover:text-gold";

export function SiteFooter({ settings }: { settings: SiteSettings | null }) {
  const socials = Object.entries(settings?.socials ?? {});
  const whatsappHref = settings?.whatsappNumber
    ? buildWhatsAppUrl(settings.whatsappNumber, strings.whatsapp.defaultMessage)
    : null;
  const hasContact = Boolean(settings?.contactEmail || settings?.phone);

  return (
    <footer className="relative isolate overflow-hidden bg-footer text-sm text-white/75">
      {/* Thin strip in the logo's teal, sun and palm colours */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-[linear-gradient(90deg,var(--color-teal),var(--color-gold),var(--color-leaf))]"
      />
      <CompassWatermark className="absolute -right-28 -bottom-32 -z-10 size-[30rem] text-white/6" />

      <div className="mx-auto max-w-[75rem] px-4 pt-14 pb-8 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex max-w-xs flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <Logo inverted size={64} className="w-fit" />
            <p className="leading-relaxed">{strings.site.tagline}</p>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit font-semibold text-gold hover:underline"
              >
                {strings.site.whatsappPrefix} · {settings?.whatsappNumber}
              </a>
            ) : null}
          </div>

          <nav aria-label="Footer explore" className="flex flex-col gap-2.5">
            <h2 className={headingClass}>{strings.footer.exploreHeading}</h2>
            {exploreLinks.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Footer company" className="flex flex-col gap-2.5">
            <h2 className={headingClass}>{strings.footer.companyHeading}</h2>
            {companyLinks.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2.5">
            <h2 className={headingClass}>{strings.footer.contactHeading}</h2>
            {settings?.contactEmail ? (
              <a href={`mailto:${settings.contactEmail}`} className={`${linkClass} break-all`}>
                {settings.contactEmail}
              </a>
            ) : null}
            {settings?.phone ? (
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                {settings.phone}
              </a>
            ) : null}
            {!hasContact ? (
              <Link href="/contact" className={linkClass}>
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
                    className="text-white/70 transition-colors hover:text-gold"
                  >
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-[0.8125rem] text-white/60 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {strings.common.siteName}. {strings.footer.copyright}
          </p>
          <p>
            <Link href="/privacy" className="hover:text-white">
              {strings.site.privacyPolicy}
            </Link>
            {" · "}
            <Link href="/terms" className="hover:text-white">
              {strings.site.termsAndConditions}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
