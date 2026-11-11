import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart, MessagesSquare, Route } from "lucide-react";

import { CtaBox, PageBanner, SectionHeading } from "@/components/site/section";
import { siteImages } from "@/content/site-images";
import { strings } from "@/content/strings";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about the local team behind Go Lanka.",
  alternates: { canonical: "/about" },
};

const valueIcons = [Route, MessagesSquare, Heart];

export default function AboutPage() {
  return (
    <>
      <PageBanner
        title={strings.about.heading}
        intro={strings.about.intro}
        image={siteImages.pidurangala}
        crumbs={[{ label: strings.nav.about }]}
      />

      <section className="mx-auto grid max-w-[60rem] items-center gap-10 px-4 pt-14 sm:px-6 md:grid-cols-2 lg:px-0">
        <div>
          <h2 className="font-heading text-[2rem] font-semibold tracking-[-0.02em] text-ink">
            {strings.about.storyTitle}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-stone">
            {strings.about.storyBody}
          </p>
          <Link href="/contact" className="btn-primary mt-6">
            {strings.about.cta}
          </Link>
        </div>
        <div className="relative h-72 overflow-hidden rounded-[1.125rem] shadow-lift sm:h-[21rem]">
          <Image
            src={siteImages.kandy.src}
            alt={siteImages.kandy.alt}
            fill
            sizes="(min-width: 768px) 460px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="px-4 pt-[4.5rem] sm:px-6">
        <SectionHeading
          eyebrow={strings.about.valuesEyebrow}
          title={strings.about.valuesHeading}
          accent={strings.about.valuesAccent}
        />
        <div className="mx-auto mt-8 grid max-w-[60rem] gap-5 md:grid-cols-3">
          {strings.home.highlights.map((item, index) => {
            const Icon = valueIcons[index] ?? Route;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-line bg-white p-6 shadow-card"
              >
                <span className="flex size-[3.25rem] items-center justify-center rounded-xl bg-tint text-brand">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                </span>
                <h3 className="mt-5 font-heading text-[1.0625rem] font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-4 pt-[4.5rem] sm:px-6">
        <SectionHeading
          eyebrow={strings.about.processEyebrow}
          title={strings.about.processHeading}
          accent={strings.about.processAccent}
        />
        <ol className="mx-auto mt-8 grid max-w-[60rem] gap-5 md:grid-cols-3">
          {strings.about.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-line bg-white p-6 shadow-card"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-heading text-[1.0625rem] font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBox
        title={strings.about.ctaTitle}
        body={strings.about.ctaBody}
        href="/contact"
        label={strings.site.planTrip}
      />
    </>
  );
}
