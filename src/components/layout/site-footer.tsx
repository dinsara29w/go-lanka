import Link from "next/link";

import { CompassWatermark } from "@/components/brand/compass";
import { LogoMark } from "@/components/brand/logo";
import { strings } from "@/content/strings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { SiteSettings } from "@/server/repositories/site-settings";

// Everything that is not in the slim top menu lives here.
const links = [
  { href: "/packages", label: strings.site.tourPackages },
  { href: "/tour-builder", label: strings.nav.tourBuilder },
  { href: "/map", label: strings.site.destinations },
  { href: "/photos", label: strings.nav.photos },
  { href: "/reviews", label: strings.nav.reviews },
  { href: "/travel-info", label: strings.nav.travelInfo },
  { href: "/about", label: strings.nav.about },
  { href: "/contact", label: strings.site.enquire },
];

const quietLink = "text-white/70 transition-colors hover:text-gold";

export function SiteFooter({ settings }: { settings: SiteSettings | null }) {
  const socials = Object.entries(settings?.socials ?? {});
  const whatsappHref = settings?.whatsappNumber
    ? buildWhatsAppUrl(settings.whatsappNumber, strings.whatsapp.defaultMessage)
    : null;
  const hasContact = Boolean(settings?.contactEmail || settings?.phone);

  return (
    <footer className="relative isolate overflow-hidden bg-footer text-white/75">
      {/* Thin strip in the logo's teal, sun and palm colours */}
      <div
        aria-hidden="true"
        className="h-1 w-full bg-[linear-gradient(90deg,var(--color-teal),var(--color-gold),var(--color-leaf))]"
      />
      <CompassWatermark className="absolute top-4 left-1/2 -z-10 size-[38rem] -translate-x-1/2 text-white/5" />

      <div className="mx-auto max-w-[75rem] px-4 pt-14 pb-8 text-center sm:px-6">
        {/* The logo is the centrepiece, with fine lines running out to each side */}
        <div className="flex items-center justify-center gap-6">
          <span
            aria-hidden="true"
            className="hidden h-px max-w-60 flex-1 bg-gradient-to-r from-transparent to-white/25 sm:block"
          />
          <Link
            href="/"
            aria-label={`${strings.common.siteName} – ${strings.common.backHome}`}
            className="rounded-2xl transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none"
          >
            <LogoMark size={208} className="h-48 w-auto sm:h-60" />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-px max-w-60 flex-1 bg-gradient-to-l from-transparent to-white/25 sm:block"
          />
        </div>

        <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/80">
          {strings.site.tagline}
        </p>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-semibold text-gold hover:underline"
          >
            {strings.site.whatsappPrefix} · {settings?.whatsappNumber}
          </a>
        ) : null}

        <nav
          aria-label="Footer"
          className="mt-9 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[0.9375rem] font-semibold"
        >
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="text-white/90 hover:text-gold">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[0.9375rem]">
          {settings?.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className={`${quietLink} break-all`}>
              {settings.contactEmail}
            </a>
          ) : null}
          {settings?.phone ? (
            <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className={quietLink}>
              {settings.phone}
            </a>
          ) : null}
          {!hasContact ? (
            <Link href="/contact" className={quietLink}>
              {strings.contact.heading}
            </Link>
          ) : null}
          {socials.map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noreferrer" className={quietLink}>
              {label.charAt(0).toUpperCase() + label.slice(1)}
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-1.5 border-t border-white/10 pt-5 text-sm text-white/60 sm:flex-row sm:justify-center sm:gap-6">
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
            {" · "}
            <Link href="/credits" className="hover:text-white">
              {strings.site.photoCredits}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
