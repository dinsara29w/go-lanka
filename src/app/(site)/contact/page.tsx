import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { strings } from "@/content/strings";
import { getSiteSettings } from "@/server/repositories/site-settings";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Sri Lanka Tours team to ask a question or plan a custom trip.",
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.contact}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.contact.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.contact.intro}</p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <ContactForm siteKey={siteKey} />
        </div>

        <aside className="space-y-5 rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
          <div>
            <h2 className="font-heading text-lg font-semibold">{strings.contact.directHeading}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {strings.contact.detailsPlaceholder}
            </p>
          </div>

          {!hasDirectDetails ? (
            <p className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
              {strings.placeholders.contact}
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {settings?.contactEmail ? (
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Mail aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span>
                    <span className="block text-xs text-muted-foreground">
                      {strings.contact.directEmail}
                    </span>
                    {settings.contactEmail}
                  </span>
                </a>
              ) : null}

              {settings?.phone ? (
                <a
                  href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Phone aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span>
                    <span className="block text-xs text-muted-foreground">
                      {strings.contact.directPhone}
                    </span>
                    {settings.phone}
                  </span>
                </a>
              ) : null}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <MessageCircle aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span>
                    <span className="block text-xs text-muted-foreground">
                      {strings.contact.directWhatsApp}
                    </span>
                    {strings.whatsapp.label}
                  </span>
                </a>
              ) : null}
            </div>
          )}

          <p className="text-xs leading-5 text-muted-foreground">
            {strings.contact.privacyNote}{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              {strings.footer.privacy}
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
