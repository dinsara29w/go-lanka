import { cookies, headers } from "next/headers";

import { CurrencyProvider } from "@/components/currency/currency-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { JsonLd } from "@/components/seo/json-ld";
import { strings } from "@/content/strings";
import { currencyFromCountry, parseCurrency, type Currency } from "@/lib/currency";
import { getSiteUrl, SITE_NAME } from "@/lib/site";
import { getLatestExchangeRates } from "@/server/repositories/exchange-rates";
import { getSiteSettings } from "@/server/repositories/site-settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, rates, cookieStore, headerStore] = await Promise.all([
    getSiteSettings(),
    getLatestExchangeRates(),
    cookies(),
    headers(),
  ]);
  const socialLinks = Object.values(settings?.socials ?? {});
  const country = headerStore.get("cf-ipcountry") ?? headerStore.get("x-vercel-ip-country") ?? null;
  const currency: Currency =
    parseCurrency(cookieStore.get("currency")?.value) ??
    currencyFromCountry(country) ??
    (rates ? "USD" : "LKR");

  const travelAgency = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: SITE_NAME,
    url: getSiteUrl(),
    description: strings.home.description,
    areaServed: { "@type": "Country", name: "Sri Lanka" },
    ...(settings?.contactEmail ? { email: settings.contactEmail } : {}),
    ...(settings?.phone ? { telephone: settings.phone } : {}),
    ...(socialLinks.length > 0 ? { sameAs: socialLinks } : {}),
  };

  return (
    <CurrencyProvider value={{ currency, rates }}>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-2 focus:outline-ring"
        >
          {strings.common.skipToContent}
        </a>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter settings={settings} />
        <WhatsAppButton number={settings?.whatsappNumber ?? null} />
        <JsonLd data={travelAgency} />
      </div>
    </CurrencyProvider>
  );
}
