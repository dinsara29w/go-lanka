import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

export const metadata: Metadata = {
  title: "Booking request received",
  robots: { index: false, follow: false },
};

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  const reference =
    typeof params.reference === "string" && /^GL-[A-Z0-9]{6,20}$/.test(params.reference)
      ? params.reference
      : null;

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-4 py-20 sm:px-6">
      <p className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
        {strings.booking.successTitle}
      </p>
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
        {strings.booking.successTitle}
      </h1>
      {reference ? (
        <div className="w-full rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{strings.booking.successBody}</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{reference}</p>
        </div>
      ) : null}
      <p className="text-base leading-7 text-muted-foreground">
        {strings.booking.successEmailNote}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/packages">{strings.booking.successCta}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">{strings.nav.contact}</Link>
        </Button>
      </div>
    </section>
  );
}
