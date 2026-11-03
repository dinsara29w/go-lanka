import Link from "next/link";
import { cn } from "cn";

import { Stars } from "@/components/site/section";

export function QuoteCard({
  rating,
  body,
  name,
  country,
  title,
  journey,
}: {
  rating: number;
  body: string;
  name: string;
  country: string | null;
  title?: string | null;
  journey?: { title: string; slug: string };
}) {
  return (
    <figure className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white px-[1.375rem] pt-[1.375rem] pb-5">
      <Stars rating={rating} />
      {title ? <p className="font-heading text-[0.9375rem] font-bold text-ink">{title}</p> : null}
      <blockquote className="text-[0.9375rem] leading-relaxed text-[#34443C] italic">
        “{body}”
      </blockquote>
      <figcaption className="mt-auto border-t border-line pt-3.5 text-sm">
        <b className="text-ink">{name}</b>
        {country ? <span className="text-stone/70"> {country}</span> : null}
        {journey ? (
          <Link
            href={`/packages/${journey.slug}`}
            className="mt-1 block text-xs font-semibold text-brand hover:underline"
          >
            {journey.title}
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function FaqList({
  faqs,
  className,
}: {
  faqs: { question: string; answer: string }[];
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-[45rem] flex-col gap-3", className)}>
      {faqs.map((faq, index) => (
        <details
          key={faq.question}
          open={index === 0}
          className="group rounded-[0.875rem] border border-line bg-white px-[1.375rem]"
        >
          <summary className="flex min-h-[3.375rem] cursor-pointer list-none items-center justify-between gap-4 font-heading text-[0.9375rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {faq.question}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F7B4A"
              strokeWidth="2.5"
              aria-hidden="true"
              className="shrink-0 transition-transform group-open:rotate-180"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <p className="pb-[1.125rem] text-sm leading-relaxed text-stone">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
