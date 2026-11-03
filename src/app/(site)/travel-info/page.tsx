import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
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
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-2xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.nav.travelInfo}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {strings.travelInfo.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.travelInfo.intro}</p>
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
          {strings.travelInfo.empty}
        </p>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.3fr_1fr] lg:items-start">
          <nav aria-label="Travel information sections" className="hidden lg:block">
            <ul className="sticky top-24 space-y-2 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.slug}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.slug}
                className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-7"
              >
                <h2 className="font-heading text-2xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                {section.summary ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.summary}</p>
                ) : null}
                <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {section.body}
                </div>
                {section.bullets.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>• {bullet}</li>
                    ))}
                  </ul>
                ) : null}

                {section.faqs.length > 0 ? (
                  <div className="mt-6 space-y-3 border-t border-border pt-5">
                    <h3 className="font-heading text-lg font-semibold">
                      {strings.travelInfo.faqHeading}
                    </h3>
                    {section.faqs.map((faq) => (
                      <details
                        key={faq.question}
                        className="rounded-lg border border-border bg-background p-4"
                      >
                        <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                          {faq.question}
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {faq.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                ) : null}

                <p className="mt-5 text-xs text-muted-foreground">
                  {strings.travelInfo.lastUpdated}: {dateFormatter.format(section.updatedAt)}
                </p>
              </section>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}
