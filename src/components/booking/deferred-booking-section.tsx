"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { strings } from "@/content/strings";
import type { PublicAvailability } from "@/server/repositories/availability";

// The booking form pulls in react-hook-form and the validation schema. Keep
// that out of the initial package-page bundle until the form is close to the
// viewport.
const BookingSection = dynamic(
  () => import("@/components/booking/booking-section").then((module) => module.BookingSection),
  { ssr: false, loading: () => <BookingSkeleton /> },
);

function BookingSkeleton() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-7" aria-busy="true">
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-4 max-w-xl animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_1.1fr]">
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted/40" />
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    </section>
  );
}

export function DeferredBookingSection({
  packageId,
  availability,
  siteKey,
}: {
  packageId: string;
  availability: PublicAvailability[];
  siteKey: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const node = containerRef.current;
    if (!node) return;

    const load = () => setReady(true);

    if (!("IntersectionObserver" in window)) {
      load();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);

    // Safety net for anchor jumps and aggressive scroll restoration.
    const timeout = window.setTimeout(load, 5000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [ready]);

  return (
    <div ref={containerRef}>
      {ready ? (
        <BookingSection packageId={packageId} availability={availability} siteKey={siteKey} />
      ) : (
        <BookingSkeleton />
      )}
    </div>
  );
}
