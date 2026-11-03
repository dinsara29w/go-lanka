import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about the local team behind Sri Lanka Tours.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm font-medium text-muted-foreground">{strings.about.eyebrow}</p>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {strings.about.heading}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{strings.about.intro}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-heading text-xl font-semibold">{strings.about.storyTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{strings.about.storyBody}</p>
          <p className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
            {strings.about.storyTodo}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-heading text-xl font-semibold">{strings.about.howTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{strings.about.howBody}</p>
        </section>
      </div>

      <section className="mt-10 flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="font-heading text-xl font-semibold">{strings.about.ctaTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{strings.about.ctaBody}</p>
        </div>
        <Button asChild>
          <Link href="/contact">
            {strings.about.cta}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
