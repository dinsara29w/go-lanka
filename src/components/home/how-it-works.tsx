import { MessageSquare, Plane, Route } from "lucide-react";

import { SectionHeading } from "@/components/site/section";
import { strings } from "@/content/strings";

const icons = [MessageSquare, Route, Plane];

export function HowItWorks() {
  const t = strings.home.how;
  return (
    <div>
      <SectionHeading eyebrow={t.eyebrow} title={t.heading} accent={t.accent} />
      <ol className="relative mt-10 grid gap-5 md:grid-cols-3">
        {t.steps.map((step, index) => {
          const Icon = icons[index] ?? Route;
          return (
            <li
              key={step.title}
              className="relative rounded-3xl border border-line bg-white p-6 shadow-card"
            >
              <span
                aria-hidden="true"
                className="absolute top-5 right-6 font-heading text-6xl leading-none font-bold text-tint select-none"
              >
                {index + 1}
              </span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-tint text-brand">
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 font-heading text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{step.description}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
