import Link from "next/link";
import { cn } from "cn";

import { Stars } from "@/components/site/section";

/** A guest review: stars, serif quote, initial avatar. */
export function QuoteCard({
  rating,
  body,
  name,
  country,
  title,
  journey,
  className,
}: {
  rating: number;
  body: string;
  name: string;
  country: string | null;
  title?: string | null;
  journey?: { title: string; slug: string };
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "relative flex flex-col gap-3.5 overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-card",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-2 right-5 font-heading text-[5.5rem] leading-none text-tint select-none"
      >
        ”
      </span>
      <Stars rating={rating} />
      {title ? <p className="font-heading text-base font-semibold text-ink">{title}</p> : null}
      <blockquote className="text-base leading-relaxed text-ink">{body}</blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-2">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white"
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 text-sm leading-tight">
          <b className="block text-ink">{name}</b>
          {country ? <span className="text-stone">{country}</span> : null}
          {journey ? (
            <Link
              href={`/packages/${journey.slug}`}
              className="mt-0.5 block text-xs font-semibold text-brand hover:underline"
            >
              {journey.title}
            </Link>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

/** Accordion list; the first question starts open. */
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
          className="group rounded-2xl border border-line bg-white px-5 transition-colors open:border-brand/40 open:shadow-card"
        >
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[0.9375rem] font-bold text-ink [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-lg leading-none font-semibold text-brand transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-5 text-sm leading-relaxed text-stone">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
