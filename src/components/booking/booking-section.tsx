"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { bookingFormSchema, type BookingFormValues } from "@/lib/validation/booking";
import type { PublicAvailability } from "@/server/repositories/availability";

const inputClass =
  "field mt-1.5 placeholder:text-stone/70 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const weekdayFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  timeZone: "UTC",
});

function dateString(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function displayDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function BookingSection({
  packageId,
  availability,
  siteKey,
}: {
  packageId: string;
  availability: PublicAvailability[];
  siteKey: string | null;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(
    availability[0]?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
  );
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      country: "",
      travelDate: "",
      adults: 2,
      children: 0,
      message: "",
      website: "",
    },
  });

  const selectedDate = useWatch({ control, name: "travelDate" });
  const adults = Number(useWatch({ control, name: "adults" })) || 0;
  const children = Number(useWatch({ control, name: "children" })) || 0;
  const partySize = adults + children;
  const availableByDate = useMemo(
    () => new Map(availability.map((item) => [item.date, item])),
    [availability],
  );
  const selectedAvailability = selectedDate ? availableByDate.get(selectedDate) : undefined;
  const selectedDateHasCapacity =
    Boolean(selectedAvailability) &&
    selectedAvailability?.status !== "closed" &&
    (selectedAvailability?.remaining ?? 0) >= partySize;

  const calendar = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthIndex = (monthNumber ?? 1) - 1;
    const firstDay = new Date(Date.UTC(year ?? 2000, monthIndex, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year ?? 2000, monthIndex + 1, 0)).getUTCDate();
    const cells: Array<{ date: string; day: number } | null> = Array.from(
      { length: firstDay },
      () => null,
    );
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: dateString(year ?? 2000, monthIndex, day), day });
    }
    return cells;
  }, [month]);

  const monthDate = new Date(`${month}-01T00:00:00Z`);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + index))),
  );

  function changeMonth(direction: -1 | 1) {
    const next = new Date(
      Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + direction, 1),
    );
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (!siteKey) {
      setServerError(strings.booking.verificationError);
      return;
    }
    if (!selectedDate) {
      setServerError(strings.booking.selectDateRequired);
      return;
    }
    if (!selectedDateHasCapacity) {
      setServerError(strings.booking.notEnoughSpots);
      return;
    }
    if (!turnstileToken) {
      setServerError(strings.booking.verificationRequired);
      return;
    }

    setSubmitting(true);
    const key = idempotencyKey ?? crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(key);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          packageId,
          turnstileToken,
          idempotencyKey: key,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reference?: string | null;
        message?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setServerError(data?.message ?? strings.booking.errorBody);
        setTurnstileToken(null);
        setWidgetKey((key) => key + 1);
        return;
      }

      const reference = data.reference;
      router.push(
        reference
          ? `/booking/success?reference=${encodeURIComponent(reference)}`
          : "/booking/success",
      );
    } catch {
      setServerError(strings.booking.errorBody);
      setTurnstileToken(null);
      setWidgetKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  });

  if (availability.length === 0) {
    return (
      <section
        id="booking"
        className="scroll-mt-24 rounded-2xl border border-dashed border-line bg-white p-6"
      >
        <h2 className="font-heading text-2xl font-bold text-ink">{strings.booking.heading}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {strings.booking.noAvailability}
        </p>
        <Button asChild className="mt-4" variant="outline">
          <a href="/contact">{strings.nav.contact}</a>
        </Button>
      </section>
    );
  }

  return (
    <section
      id="booking"
      className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7"
    >
      <div className="max-w-2xl space-y-2">
        <h2 className="font-heading text-2xl font-bold text-ink">{strings.booking.heading}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{strings.booking.intro}</p>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-line bg-page p-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={strings.booking.previousMonth}
              onClick={() => changeMonth(-1)}
            >
              ‹
            </Button>
            <p className="font-medium">{monthFormatter.format(monthDate)}</p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={strings.booking.nextMonth}
              onClick={() => changeMonth(1)}
            >
              ›
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendar.map((cell, index) => {
              if (!cell) return <span key={`empty-${index}`} />;
              const item = availableByDate.get(cell.date);
              const bookable =
                Boolean(item) &&
                item?.status !== "closed" &&
                (item?.remaining ?? 0) >= Math.max(partySize, 1);
              const selected = selectedDate === cell.date;

              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={!bookable}
                  aria-pressed={selected}
                  aria-label={`${displayDate(cell.date)}${item ? `, ${item.status}, ${item.remaining} ${strings.booking.remaining}` : ""}`}
                  onClick={() => {
                    setValue("travelDate", cell.date, { shouldValidate: true });
                    setServerError(null);
                  }}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-md border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    selected
                      ? "border-brand bg-brand text-white"
                      : bookable
                        ? "border-line bg-white hover:border-brand hover:bg-tint"
                        : "cursor-not-allowed border-transparent text-muted-foreground/40"
                  }`}
                >
                  <span className="text-sm font-medium">{cell.day}</span>
                  {item ? (
                    <span className="text-[10px]">
                      {item.status === "closed"
                        ? strings.booking.closed
                        : `${item.remaining} ${strings.booking.remaining}`}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {strings.booking.availabilityNote}
          </p>
          <div className="mt-4 text-sm">
            <span className="text-muted-foreground">{strings.booking.selectedDate}: </span>
            <span className="font-medium">
              {selectedDate ? displayDate(selectedDate) : strings.booking.notSelected}
            </span>
          </div>
          {selectedDate && !selectedDateHasCapacity ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {strings.booking.notEnoughSpots}
            </p>
          ) : null}
          {errors.travelDate ? (
            <p
              id="booking-travel-date-error"
              role="alert"
              className="mt-2 text-sm text-destructive"
            >
              {errors.travelDate.message}
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <input
            type="hidden"
            aria-describedby={errors.travelDate ? "booking-travel-date-error" : undefined}
            {...register("travelDate")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="booking-name" className="text-xs font-semibold text-brand">
                {strings.booking.name}
              </label>
              <input
                id="booking-name"
                autoComplete="name"
                className={inputClass}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "booking-name-error" : undefined}
                {...register("name")}
              />
              {errors.name ? (
                <p id="booking-name-error" className="mt-1.5 text-sm text-destructive">
                  {errors.name.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="booking-email" className="text-xs font-semibold text-brand">
                {strings.booking.email}
              </label>
              <input
                id="booking-email"
                type="email"
                autoComplete="email"
                className={inputClass}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "booking-email-error" : undefined}
                {...register("email")}
              />
              {errors.email ? (
                <p id="booking-email-error" className="mt-1.5 text-sm text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="booking-phone" className="text-xs font-semibold text-brand">
                {strings.booking.phone}
              </label>
              <input
                id="booking-phone"
                type="tel"
                autoComplete="tel"
                className={inputClass}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "booking-phone-error" : undefined}
                {...register("phone")}
              />
              {errors.phone ? (
                <p id="booking-phone-error" className="mt-1.5 text-sm text-destructive">
                  {errors.phone.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="booking-country" className="text-xs font-semibold text-brand">
                {strings.booking.country}
              </label>
              <input
                id="booking-country"
                autoComplete="country-name"
                className={inputClass}
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={errors.country ? "booking-country-error" : undefined}
                {...register("country")}
              />
              {errors.country ? (
                <p id="booking-country-error" className="mt-1.5 text-sm text-destructive">
                  {errors.country.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="booking-adults" className="text-xs font-semibold text-brand">
                {strings.booking.adults}
              </label>
              <input
                id="booking-adults"
                type="number"
                min={1}
                max={30}
                className={inputClass}
                aria-invalid={errors.adults ? true : undefined}
                aria-describedby={errors.adults ? "booking-adults-error" : undefined}
                {...register("adults", { valueAsNumber: true })}
              />
              {errors.adults ? (
                <p id="booking-adults-error" className="mt-1.5 text-sm text-destructive">
                  {errors.adults.message}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="booking-children" className="text-xs font-semibold text-brand">
                {strings.booking.children}
              </label>
              <input
                id="booking-children"
                type="number"
                min={0}
                max={20}
                className={inputClass}
                aria-invalid={errors.children ? true : undefined}
                aria-describedby={errors.children ? "booking-children-error" : undefined}
                {...register("children", { valueAsNumber: true })}
              />
              {errors.children ? (
                <p id="booking-children-error" className="mt-1.5 text-sm text-destructive">
                  {errors.children.message}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="booking-message" className="text-xs font-semibold text-brand">
              {strings.booking.message}
            </label>
            <textarea
              id="booking-message"
              rows={4}
              className={inputClass}
              placeholder={strings.booking.messagePlaceholder}
              {...register("message")}
            />
          </div>

          <div
            className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label htmlFor="booking-website">Website</label>
            <input id="booking-website" tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>

          {siteKey ? (
            <TurnstileWidget
              key={widgetKey}
              siteKey={siteKey}
              action="booking"
              onToken={setTurnstileToken}
            />
          ) : (
            <p className="text-sm text-destructive">{strings.booking.verificationError}</p>
          )}

          {serverError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <p className="font-medium">{strings.booking.errorTitle}</p>
              <p className="mt-1">{serverError}</p>
            </div>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">{strings.booking.requestNote}</p>

          <button
            type="submit"
            className="btn-pill w-full"
            disabled={
              submitting ||
              !turnstileToken ||
              !selectedDate ||
              !selectedDateHasCapacity ||
              partySize < 1
            }
          >
            {submitting ? strings.booking.sending : strings.booking.submit}
          </button>
        </form>
      </div>
    </section>
  );
}
