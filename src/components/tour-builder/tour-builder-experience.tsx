"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "cn";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { TourMapPins } from "@/components/tour-builder/tour-map-pins";
import { strings } from "@/content/strings";
import {
  BOARD_LABELS,
  BOARD_TYPES,
  BUDGET_LABELS,
  BUDGET_TIERS,
  type BoardType,
  type BudgetTier,
} from "@/lib/tour-builder";
import type { GeneratedItinerary } from "@/lib/validation/tour-builder";

type DestinationOption = {
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  region?: string | null;
  image?: { src: string; alt: string };
};

type TourResult = {
  sessionId: string;
  reference: string;
  itinerary: GeneratedItinerary;
  selectedPackage: { title: string; slug: string };
  distanceKm: number;
  vehicleName: string | null;
};

const inputClass = "field mt-1.5 placeholder:text-stone/70";
const labelClass = "text-xs font-semibold text-brand";
const cardClass = "rounded-[1.125rem] border border-line bg-white p-5 shadow-card sm:p-6";
const stepHeadingClass = "font-heading text-[1.625rem] font-bold text-ink";

function monthOptions() {
  const formatter = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: formatter.format(new Date(Date.UTC(2026, index, 1))),
  }));
}

export function TourBuilderExperience({
  destinations,
  siteKey,
  initialDays = 7,
  initialAdults = 2,
}: {
  destinations: DestinationOption[];
  siteKey: string | null;
  initialDays?: number;
  initialAdults?: number;
}) {
  const [locations, setLocations] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetTier>("star");
  const [board, setBoard] = useState<BoardType>("half_board");
  const [selfDrive, setSelfDrive] = useState(false);
  const [days, setDays] = useState(initialDays);
  const [nights, setNights] = useState(Math.max(initialDays - 1, 0));
  const [travelMonth, setTravelMonth] = useState(new Date().getUTCMonth() + 1);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(0);
  const [notes, setNotes] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<TourResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleLocation(slug: string) {
    setLocations((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length >= 10
          ? current
          : [...current, slug],
    );
  }

  function changeDays(next: number) {
    const safe = Math.min(Math.max(next, 1), 21);
    setDays(safe);
    setNights(Math.max(safe - 1, 0));
  }

  async function submit() {
    setError(null);
    setFallback(null);
    setResult(null);
    if (!siteKey) {
      setError(strings.tourBuilder.verificationError);
      return;
    }
    if (!token) {
      setError(strings.tourBuilder.verificationRequired);
      return;
    }
    if (locations.length === 0) {
      setError(strings.tourBuilder.api.invalid);
      return;
    }

    setBuilding(true);
    setProgress(strings.tourBuilder.progressStarting);

    try {
      const response = await fetch("/api/tour-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations,
          budget,
          board,
          selfDrive,
          days,
          nights,
          travelMonth,
          adults,
          children,
          notes,
          turnstileToken: token,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? strings.tourBuilder.fallback);
        setToken(null);
        setWidgetKey((key) => key + 1);
        return;
      }
      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as {
            type: string;
            stage?: string;
            message?: string;
            result?: TourResult;
          };
          if (event.type === "progress" && event.stage) setProgress(event.stage);
          if (event.type === "result" && event.result) {
            setResult(event.result);
            setFallback(null);
          }
          if (event.type === "fallback") {
            setFallback(event.message ?? strings.tourBuilder.fallback);
          }
        }
      }
    } catch {
      setFallback(strings.tourBuilder.fallback);
    } finally {
      setBuilding(false);
      setToken(null);
      setWidgetKey((key) => key + 1);
    }
  }

  if (result) {
    return (
      <TourResultView
        result={result}
        destinations={destinations}
        siteKey={siteKey}
        onStartOver={() => {
          setResult(null);
          setFallback(null);
          setError(null);
        }}
      />
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm leading-6 text-stone">
        <p>{strings.tourBuilder.fallback}</p>
        <Link href="/contact" className="btn-outline-pill mt-4">
          {strings.nav.contact}
        </Link>
      </div>
    );
  }

  const chosen = locations
    .map((slug) => destinations.find((destination) => destination.slug === slug))
    .filter((destination): destination is DestinationOption => Boolean(destination));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-10">
        <section>
          <h2 className={stepHeadingClass}>1. {strings.tourBuilder.locations}</h2>
          <p className="mt-1 text-[0.9375rem] text-stone">{strings.tourBuilder.locationsHint}</p>
          <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            {destinations.map((destination) => {
              const selected = locations.includes(destination.slug);
              return (
                <button
                  key={destination.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleLocation(destination.slug)}
                  className={cn(
                    "zoom-img relative block h-44 overflow-hidden rounded-2xl text-left shadow-[0_4px_22px_rgba(16,33,26,0.1)] transition-shadow sm:h-[14.375rem]",
                    selected ? "ring-4 ring-brand ring-offset-2 ring-offset-page" : "",
                  )}
                >
                  {destination.image ? (
                    <Image
                      src={destination.image.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 200px, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 bg-brand-dark" />
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(0deg,rgba(16,33,26,0.8),rgba(16,33,26,0)_55%)]"
                  />
                  {selected ? (
                    <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-brand text-white shadow">
                      <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className="absolute inset-x-4 bottom-4 text-white">
                    <span className="block font-heading text-lg leading-tight font-bold">
                      {destination.name}
                    </span>
                    {destination.region ? (
                      <span className="mt-0.5 block text-[0.8125rem] text-white/85">
                        {destination.region}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className={stepHeadingClass}>2. {strings.tourBuilder.yourTrip}</h2>
          <div className={cn(cardClass, "mt-4 space-y-6")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="builder-days" className={labelClass}>
                  {strings.tourBuilder.days}
                </label>
                <input
                  id="builder-days"
                  type="number"
                  min={1}
                  max={21}
                  value={days}
                  onChange={(event) => changeDays(Number(event.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="builder-nights" className={labelClass}>
                  {strings.tourBuilder.nights}
                </label>
                <input
                  id="builder-nights"
                  type="number"
                  min={0}
                  max={21}
                  value={nights}
                  onChange={(event) => setNights(Number(event.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="builder-month" className={labelClass}>
                  {strings.tourBuilder.travelMonth}
                </label>
                <select
                  id="builder-month"
                  value={travelMonth}
                  onChange={(event) => setTravelMonth(Number(event.target.value))}
                  className={inputClass}
                >
                  {monthOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="builder-adults" className={labelClass}>
                  {strings.tourBuilder.adults}
                </label>
                <input
                  id="builder-adults"
                  type="number"
                  min={1}
                  max={10}
                  value={adults}
                  onChange={(event) => setAdults(Number(event.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="builder-children" className={labelClass}>
                  {strings.tourBuilder.children}
                </label>
                <input
                  id="builder-children"
                  type="number"
                  min={0}
                  max={10}
                  value={children}
                  onChange={(event) => setChildren(Number(event.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>{strings.tourBuilder.budget}</legend>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {BUDGET_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    aria-pressed={budget === tier}
                    onClick={() => setBudget(tier)}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold transition-colors",
                      budget === tier
                        ? "bg-brand text-white"
                        : "border border-line bg-white text-ink hover:border-brand hover:text-brand",
                    )}
                  >
                    {BUDGET_LABELS[tier]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={labelClass}>{strings.tourBuilder.board}</legend>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                {BOARD_TYPES.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                      board === option
                        ? "border-brand bg-tint font-semibold text-brand"
                        : "border-line bg-white text-ink-soft hover:border-brand",
                    )}
                  >
                    <input
                      type="radio"
                      name="board"
                      className="accent-brand"
                      checked={board === option}
                      onChange={() => setBoard(option)}
                    />
                    {BOARD_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-page p-3.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-brand"
                checked={selfDrive}
                onChange={(event) => setSelfDrive(event.target.checked)}
              />
              <span>
                <span className="font-semibold text-ink">{strings.tourBuilder.selfDrive}</span>
                <span className="mt-1 block text-xs leading-5 text-stone">
                  {strings.tourBuilder.selfDriveHint}
                </span>
              </span>
            </label>

            <div>
              <label htmlFor="builder-notes" className={labelClass}>
                {strings.tourBuilder.notes}
              </label>
              <textarea
                id="builder-notes"
                rows={3}
                maxLength={800}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
                placeholder={strings.tourBuilder.notesPlaceholder}
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className={cn(cardClass, "space-y-5 shadow-panel")}>
          <div>
            <h2 className="font-heading text-[1.375rem] font-bold text-ink">
              {strings.tourBuilder.yourTrip}
            </h2>
            <p className="mt-2 text-sm text-stone" aria-live="polite">
              {chosen.length}{" "}
              {chosen.length === 1
                ? strings.tourBuilder.placeChosen
                : strings.tourBuilder.placesChosen}
              {" · "}
              {days} {strings.tourBuilder.days.toLowerCase()}
            </p>
            {chosen.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {chosen.map((destination) => (
                  <li key={destination.slug}>
                    <button
                      type="button"
                      onClick={() => toggleLocation(destination.slug)}
                      aria-label={`${strings.tourBuilder.remove} ${destination.name}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-1.5 text-sm font-semibold text-brand hover:bg-[#D3ECDD]"
                    >
                      {destination.name}
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {fallback ? (
            <div className="rounded-xl border border-dashed border-line bg-page p-4 text-sm leading-6 text-stone">
              <p>{fallback}</p>
              <Link
                href="/contact"
                className="mt-2 inline-block font-semibold text-brand hover:underline"
              >
                {strings.nav.contact}
              </Link>
            </div>
          ) : null}

          {building ? (
            <div className="rounded-xl bg-tint p-4" role="status" aria-live="polite">
              <p className="text-sm font-semibold text-brand">{strings.tourBuilder.building}</p>
              <p className="mt-1 text-xs text-stone">{progress}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
              </div>
            </div>
          ) : null}

          {siteKey ? (
            <TurnstileWidget
              key={widgetKey}
              siteKey={siteKey}
              action="tour-builder"
              onToken={setToken}
            />
          ) : (
            <p className="text-sm text-destructive">{strings.tourBuilder.verificationError}</p>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={building || !siteKey || !token || locations.length === 0}
            className="btn-pill w-full"
          >
            {building ? strings.tourBuilder.building : strings.tourBuilder.submit}
          </button>
          <p className="text-center text-xs leading-5 text-stone">
            {strings.tourBuilder.reviewNote}
          </p>
        </div>
      </aside>
    </div>
  );
}

function TourResultView({
  result,
  destinations,
  siteKey,
  onStartOver,
}: {
  result: TourResult;
  destinations: DestinationOption[];
  siteKey: string | null;
  onStartOver: () => void;
}) {
  const destinationSlugs = result.itinerary.days.map((day) => day.destination_slug);
  const destinationNames = new Map(destinations.map((item) => [item.slug, item.name]));

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-[1.125rem] border border-line bg-white p-6 shadow-card">
        <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
          {strings.tourBuilder.resultHeading}
        </p>
        <h2 className="font-heading text-3xl font-extrabold tracking-[-0.02em] text-ink">
          {result.itinerary.title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {result.itinerary.summary}
        </p>

        <div className="rounded-xl bg-tint p-4">
          <p className="text-sm font-semibold text-ocean">
            {strings.tourBuilder.underReviewHeading}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {strings.tourBuilder.underReviewBody}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {strings.tourBuilder.reference}:{" "}
            <span className="font-mono font-medium">{result.reference}</span>
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{strings.tourBuilder.selectedPackage}</dt>
            <dd className="font-medium">{result.selectedPackage.title}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{strings.tourBuilder.distance}</dt>
            <dd className="font-medium">{Math.round(result.distanceKm)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{strings.tourBuilder.vehicle}</dt>
            <dd className="font-medium">{result.vehicleName ?? strings.tourBuilder.noMapPins}</dd>
          </div>
        </dl>
      </div>

      <TourMapPins destinationSlugs={destinationSlugs} destinations={destinations} />

      <div className="space-y-4">
        {result.itinerary.days.map((day) => (
          <article
            key={day.day}
            className="rounded-[1.125rem] border border-line bg-white p-5 shadow-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                {strings.tourBuilder.dayLabel} {day.day}
              </p>
              <p className="text-xs text-muted-foreground">
                {destinationNames.get(day.destination_slug) ?? day.destination_slug}
                {day.travel_km > 0
                  ? ` · ${strings.tourBuilder.dayTravel}: ${Math.round(day.travel_km)} km`
                  : ""}
              </p>
            </div>
            <h3 className="mt-2 font-heading text-xl font-bold text-ink">{day.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{day.notes}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {day.activities.map((activity) => (
                <span
                  key={activity}
                  className="rounded-full bg-tint px-2.5 py-1 text-xs font-semibold text-brand"
                >
                  {activity}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Overnight: </span>
              {day.overnight}
            </p>
          </article>
        ))}
      </div>

      <QuoteContactForm
        sessionId={result.sessionId}
        reference={result.reference}
        siteKey={siteKey}
      />

      <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
        {strings.tourBuilder.noPricingNote}
      </p>

      <button type="button" className="btn-outline-pill" onClick={onStartOver}>
        {strings.tourBuilder.startOver}
      </button>
    </div>
  );
}

function QuoteContactForm({
  sessionId,
  reference,
  siteKey,
}: {
  sessionId: string;
  reference: string;
  siteKey: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (!siteKey) {
    return <p className="text-sm text-destructive">{strings.tourBuilder.verificationError}</p>;
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <h3 className="font-heading text-xl font-bold text-ink">
          {strings.tourBuilder.contactSuccess}
        </h3>
        <p className="mt-2 text-sm leading-6">{strings.tourBuilder.contactSuccessBody}</p>
        <p className="mt-3 font-mono text-lg font-semibold">{reference}</p>
      </div>
    );
  }

  async function submitQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tour-builder/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          reference,
          travelDate,
          name,
          email,
          phone,
          country,
          message,
          turnstileToken: token,
          idempotencyKey,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reference?: string;
        message?: string;
      } | null;
      if (!response.ok || !data?.ok || !data.reference) {
        setError(data?.message ?? strings.tourBuilder.quoteError);
        setToken(null);
        setWidgetKey((value) => value + 1);
        return;
      }
      setSent(true);
    } catch {
      setError(strings.tourBuilder.quoteError);
      setToken(null);
      setWidgetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[1.125rem] border border-line bg-white p-5 shadow-card sm:p-6">
      <h3 className="font-heading text-xl font-bold text-ink">
        {strings.tourBuilder.contactHeading}
      </h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {strings.tourBuilder.contactIntro}
      </p>

      <form onSubmit={submitQuote} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quote-name" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.name}
            </label>
            <input
              id="quote-name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="quote-email" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.email}
            </label>
            <input
              id="quote-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="quote-phone" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.phone}
            </label>
            <input
              id="quote-phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="quote-country" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.country}
            </label>
            <input
              id="quote-country"
              required
              autoComplete="country-name"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="quote-date" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.travelDate}
            </label>
            <input
              id="quote-date"
              type="date"
              required
              value={travelDate}
              onChange={(event) => setTravelDate(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="quote-message" className="text-xs font-semibold text-brand">
              {strings.tourBuilder.message}
            </label>
            <textarea
              id="quote-message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <TurnstileWidget key={widgetKey} siteKey={siteKey} action="quote" onToken={setToken} />

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-pill" disabled={submitting || !token}>
          {submitting ? strings.tourBuilder.contactSending : strings.tourBuilder.contactSubmit}
        </button>
      </form>
    </section>
  );
}
