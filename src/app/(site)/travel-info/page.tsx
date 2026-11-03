import type { Metadata } from "next";

import {
  Backpack,
  Banknote,
  CalendarDays,
  Car,
  FileText,
  HeartPulse,
  Info,
  type LucideIcon,
} from "lucide-react";

import { FaqList } from "@/components/site/blocks";
import { CtaBox, PageBanner, SectionHeading } from "@/components/site/section";
import { JsonLd } from "@/components/seo/json-ld";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";
import { listPublishedTravelInfo } from "@/server/repositories/travel-info";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel information",
  description: "Practical travel guidance for planning a Sri Lanka trip.",
  alternates: { canonical: "/travel-info" },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default async function TravelInfoPage() {
  const sections = await listPublishedTravelInfo();
  const faqs = sections.flatMap((section) => section.faqs);

  return (
    <>
      <PageBanner
        title={strings.travelInfo.heading}
        intro={strings.travelInfo.intro}
        image={siteImages.hills}
        crumbs={[{ label: strings.nav.travelInfo }]}
      />

      <div className="mx-auto max-w-[60rem] px-4 pt-10 sm:px-6 lg:px-0">
        {sections.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-stone">
            {strings.travelInfo.empty}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => {
              const Icon = sectionIcon(section.slug);
              return (
                <section
                  key={section.id}
                  id={section.slug}
                  className="scroll-mt-24 rounded-[1.125rem] border border-line bg-white p-6 shadow-card"
                >
                  <span className="flex size-[3.25rem] items-center justify-center rounded-xl bg-tint text-brand">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                  </span>
                  <h2 className="mt-5 font-heading text-[1.1875rem] font-bold text-ink">
                    {section.title}
                  </h2>
                  {section.summary ? (
                    <p className="mt-1.5 text-sm font-medium text-ink-soft">{section.summary}</p>
                  ) : null}
                  {section.body ? (
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-stone">
                      {section.body}
                    </p>
                  ) : null}
                  {section.bullets.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-sm text-stone">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span aria-hidden="true" className="text-brand">
                            •
                          </span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-4 text-xs text-stone/80">
                    {strings.travelInfo.lastUpdated}: {dateFormatter.format(section.updatedAt)}
                  </p>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {faqs.length > 0 ? (
        <section className="px-4 pt-[4.5rem] sm:px-6">
          <SectionHeading
            eyebrow={strings.home.faqEyebrow}
            title={strings.home.faqHeading}
            accent={strings.home.faqAccent}
          />
          <FaqList faqs={faqs} className="mt-8" />
        </section>
      ) : null}

      <CtaBox
        title={strings.travelInfo.ctaHeading}
        body={strings.travelInfo.ctaBody}
        href="/contact"
        label={strings.travelInfo.ctaButton}
      />

      {faqs.length > 0 ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }}
        />
      ) : null}
    </>
  );
}

function sectionIcon(slug: string): LucideIcon {
  if (/time|season|weather|when/.test(slug)) return CalendarDays;
  if (/visa|entry|passport/.test(slug)) return FileText;
  if (/money|currency|cash|cost|tip/.test(slug)) return Banknote;
  if (/transport|getting|travel-around|driver|train/.test(slug)) return Car;
  if (/health|safety|insurance|vaccin/.test(slug)) return HeartPulse;
  if (/pack|clothing|dress/.test(slug)) return Backpack;
  return Info;
}
