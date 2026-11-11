import type { Metadata } from "next";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { PageBanner } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { getSiteSettings } from "@/server/repositories/site-settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Go Lanka team to ask a question or plan a custom trip.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const whatsappHref = settings?.whatsappNumber
    ? buildWhatsAppUrl(settings.whatsappNumber, strings.whatsapp.defaultMessage)
    : null;

  const hasDirectDetails =
    Boolean(settings?.contactEmail) || Boolean(settings?.phone) || Boolean(whatsappHref);

  const rows = [
    settings?.contactEmail
      ? {
          icon: Mail,
          label: strings.contact.directEmail,
          value: settings.contactEmail,
          href: `mailto:${settings.contactEmail}`,
          external: false,
        }
      : null,
    whatsappHref
      ? {
          icon: MessageCircle,
          label: strings.contact.directWhatsApp,
          value: settings?.whatsappNumber ?? strings.whatsapp.label,
          href: whatsappHref,
          external: true,
        }
      : null,
    settings?.phone
      ? {
          icon: Phone,
          label: strings.contact.directPhone,
          value: settings.phone,
          href: `tel:${settings.phone.replace(/[^\d+]/g, "")}`,
          external: false,
        }
      : null,
  ].filter((row) => row !== null);

  return (
    <>
      <PageBanner
        title={strings.contact.heading}
        intro={strings.contact.intro}
        image={siteImages.downSouth}
        crumbs={[{ label: strings.nav.contact }]}
      />

      <div className="mx-auto grid max-w-[60rem] gap-7 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:px-0">
        <section className="rounded-[1.125rem] border border-line bg-white p-6 shadow-panel sm:p-8">
          <h2 className="mb-5 font-heading text-[1.625rem] font-semibold text-ink">
            {strings.contact.formHeading}
          </h2>
          <ContactForm siteKey={siteKey} />
        </section>

        <aside className="rounded-[1.125rem] border border-line bg-white p-6 shadow-panel sm:p-8">
          <h2 className="font-heading text-[1.375rem] font-semibold text-ink">
            {strings.contact.directHeading}
          </h2>
          {!hasDirectDetails ? (
            <p className="mt-4 text-sm leading-6 text-stone">
              {strings.contact.detailsPlaceholder}
            </p>
          ) : (
            <ul className="mt-5 space-y-5">
              {rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.label}>
                    <a
                      href={row.href}
                      {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group flex items-center gap-4"
                    >
                      <span className="flex size-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-tint text-brand">
                        <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] text-stone">{row.label}</span>
                        <span className="block font-heading text-[1.0625rem] font-semibold break-all text-ink group-hover:text-brand">
                          {row.value}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
