import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { CompassWatermark } from "@/components/brand/compass";
import { mainPlaces } from "@/content/places";
import { strings } from "@/content/strings";

// One short line per stop, only to show what a drafted route looks like.
const exampleLines: Record<string, string> = {
  colombo: "Arrive and settle in",
  pinnawala: "Elephant orphanage, then on to the hills",
  anuradhapura: "Ancient stupas and the sacred Bodhi tree",
  sigiriya: "Lion Rock at sunrise",
  kandy: "Temple of the Tooth and the lake",
  "nuwara-eliya": "Tea country and cool air",
  ella: "Nine Arch Bridge and the train",
  "down-south": "Galle Fort and the beach",
};

/** Feature panel for the AI tour builder, with a static example of the kind of route it drafts. */
export function AiBuilderPromo() {
  const t = strings.home.ai;
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#0b2a3d_0%,#1b4f6b_62%,#2b6a8c_100%)] px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14">
      <CompassWatermark className="absolute -top-20 -left-20 -z-10 size-96 text-white/6" />
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-bold tracking-[0.16em] uppercase backdrop-blur-sm">
            <Sparkles aria-hidden="true" className="size-3.5 text-gold" />
            {t.eyebrow}
          </p>
          <h2 className="mt-5 font-heading text-[1.75rem] leading-[1.15] font-bold tracking-[-0.02em] text-balance sm:text-[2.375rem]">
            {t.title}
          </h2>
          <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-white/80 sm:text-base">
            {t.body}
          </p>
          <ul className="mt-6 space-y-3">
            {t.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm font-medium text-white/90">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
                  <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/tour-builder" className="btn-gold">
              {t.cta}
            </Link>
            <span className="text-sm text-white/70">{t.note}</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 text-ink shadow-lift sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.14em] text-teal-deep uppercase">
                {t.exampleLabel}
              </p>
              <p className="font-heading text-lg font-bold">{t.exampleTitle}</p>
            </div>
            <span className="rounded-full bg-tint px-3 py-1 text-xs font-bold text-brand-dark">
              {mainPlaces.length} {strings.site.days}
            </span>
          </div>
          <ol className="mt-5 space-y-0">
            {mainPlaces.map((place, index) => (
              <li key={place.slug} className="relative flex gap-3.5 pb-4 last:pb-0">
                {index < mainPlaces.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-8 bottom-0 left-[0.9375rem] w-px border-l border-dashed border-line"
                  />
                ) : null}
                <span className="relative flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <b className="block text-sm text-ink">{place.name}</b>
                  <span className="text-[0.8125rem] text-stone">
                    {exampleLines[place.slug] ?? place.blurb}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-dashed border-line pt-4 text-xs leading-relaxed text-stone">
            {t.exampleNote}
          </p>
        </div>
      </div>
    </div>
  );
}
