"use client";

import { useState } from "react";
import Link from "next/link";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { TourMapPins } from "@/components/tour-builder/tour-map-pins";
import { Button } from "@/components/ui/button";
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
};

type TourResult = {
  sessionId: string;
  reference: string;
  itinerary: GeneratedItinerary;
  selectedPackage: { title: string; slug: string };
  distanceKm: number;
  vehicleName: string | null;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

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
}: {
  destinations: DestinationOption[];
  siteKey: string | null;
}) {
  const [locations, setLocations] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetTier>("star");
  const [board, setBoard] = useState<BoardType>("half_board");
  const [selfDrive, setSelfDrive] = useState(false);
  const [days, setDays] = useState(7);
  const [nights, setNights] = useState(6);
  const [travelMonth, setTravelMonth] = useState(new Date().getUTCMonth() + 1);
  const [adults, setAdults] = useState(2);
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
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
        <p>{strings.tourBuilder.fallback}</p>
        <Button asChild className="mt-3" variant="outline">
          <Link href="/contact">{strings.nav.contact}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {fallback ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm leading-6 text-muted-foreground">
          <p>{fallback}</p>
          <Button asChild className="mt-3" variant="outline">
            <Link href="/contact">{strings.nav.contact}</Link>
          </Button>
        </div>
      ) : null}

      {building ? (
        <div
          className="rounded-xl border border-border bg-card p-6"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">{strings.tourBuilder.building}</p>
          <p className="mt-2 text-sm text-muted-foreground">{progress}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div>
            <p className="text-sm font-medium">{strings.tourBuilder.locations}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {strings.tourBuilder.locationsHint}
            </p>
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {destinations.map((destination) => {
                const selected = locations.includes(destination.slug);
                return (
                  <label
                    key={destination.slug}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selected
                        ? "border-primary bg-primary/10 font-medium text-ocean"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected}
                      onChange={() => toggleLocation(destination.slug)}
                    />
                    {destination.name}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">{strings.tourBuilder.budget}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {BUDGET_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={budget === tier}
                  onClick={() => setBudget(tier)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    budget === tier
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {BUDGET_LABELS[tier]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">{strings.tourBuilder.board}</p>
            <div className="mt-2 space-y-2">
              {BOARD_TYPES.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    board === option
                      ? "border-primary bg-primary/10 font-medium text-ocean"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="board"
                    className="accent-primary"
                    checked={board === option}
                    onChange={() => setBoard(option)}
                  />
                  {BOARD_LABELS[option]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="builder-days" className="text-sm font-medium">
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
              <label htmlFor="builder-nights" className="text-sm font-medium">
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
              <label htmlFor="builder-adults" className="text-sm font-medium">
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
              <label htmlFor="builder-children" className="text-sm font-medium">
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
            <div className="sm:col-span-2">
              <label htmlFor="builder-month" className="text-sm font-medium">
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
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={selfDrive}
              onChange={(event) => setSelfDrive(event.target.checked)}
            />
            <span>
              <span className="font-medium">{strings.tourBuilder.selfDrive}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {strings.tourBuilder.selfDriveHint}
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="builder-notes" className="text-sm font-medium">
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

          <Button
            type="button"
            onClick={submit}
            disabled={building || !siteKey || !token || locations.length === 0}
            className="w-full"
          >
            {building ? strings.tourBuilder.building : strings.tourBuilder.submit}
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-6 text-sm leading-7 text-muted-foreground">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            {strings.tourBuilder.heading}
          </h2>
          <p className="mt-3">{strings.tourBuilder.intro}</p>
          <ul className="mt-5 space-y-2">
            <li>• {strings.tourBuilder.locationsHint}</li>
            <li>• {strings.tourBuilder.selfDriveHint}</li>
            <li>• {strings.tourBuilder.noPricingNote}</li>
          </ul>
          <p className="mt-6 rounded-xl border border-dashed border-border bg-background p-4 text-xs leading-5">
            {strings.tourBuilder.underReviewBody}
          </p>
        </div>
      </div>
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
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm font-medium text-accent-foreground">
          {strings.tourBuilder.resultHeading}
        </p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          {result.itinerary.title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {result.itinerary.summary}
        </p>

        <div className="rounded-xl border border-gold/30 bg-gold/10 p-4">
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
            <dt className="text-xs text-muted-foreground">
              {strings.tourBuilder.selectedPackage}
            </dt>
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
          <article key={day.day} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                {strings.tourBuilder.dayLabel} {day.day}
              </p>
              <p className="text-xs text-muted-foreground">
                {destinationNames.get(day.destination_slug) ?? day.destination_slug}
                {day.travel_km > 0
                  ? ` · ${strings.tourBuilder.dayTravel}: ${Math.round(day.travel_km)} km`
                  : ""}
              </p>
            </div>
            <h3 className="mt-2 font-heading text-xl font-semibold">{day.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{day.notes}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {day.activities.map((activity) => (
                <span
                  key={activity}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
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

      <Button variant="outline" onClick={onStartOver}>
        {strings.tourBuilder.startOver}
      </Button>
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
        <h3 className="font-heading text-xl font-semibold">
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
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h3 className="font-heading text-xl font-semibold">{strings.tourBuilder.contactHeading}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {strings.tourBuilder.contactIntro}
      </p>

      <form onSubmit={submitQuote} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quote-name" className="text-sm font-medium">
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
            <label htmlFor="quote-email" className="text-sm font-medium">
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
            <label htmlFor="quote-phone" className="text-sm font-medium">
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
            <label htmlFor="quote-country" className="text-sm font-medium">
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
            <label htmlFor="quote-date" className="text-sm font-medium">
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
            <label htmlFor="quote-message" className="text-sm font-medium">
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

        <Button type="submit" disabled={submitting || !token}>
          {submitting ? strings.tourBuilder.contactSending : strings.tourBuilder.contactSubmit}
        </Button>
      </form>
    </section>
  );
}
