"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import type { AdminDestinationOption, AdminItineraryDay } from "@/lib/admin-types";

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function renumber(days: AdminItineraryDay[]): AdminItineraryDay[] {
  return days.map((day, index) => ({ ...day, dayNumber: index + 1 }));
}

export function ItineraryEditor({
  name,
  initialDays,
  destinations,
}: {
  name: string;
  initialDays: AdminItineraryDay[];
  destinations: AdminDestinationOption[];
}) {
  const [days, setDays] = useState<AdminItineraryDay[]>(
    initialDays.length > 0
      ? initialDays
      : [
          {
            dayNumber: 1,
            title: "",
            description: "",
            destinationId: null,
            accommodation: "",
            meals: [],
          },
        ],
  );

  function update(index: number, patch: Partial<AdminItineraryDay>) {
    setDays((current) =>
      current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setDays((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return renumber(next);
    });
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(days)} />
      <div>
        <p className="text-sm font-medium">{strings.admin.itinerary}</p>
        <p className="text-xs leading-5 text-muted-foreground">{strings.admin.itineraryHint}</p>
      </div>

      <div className="space-y-4">
        {days.map((day, index) => (
          <div
            key={`${day.dayNumber}-${index}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-heading text-sm font-semibold">
                {strings.admin.day} {day.dayNumber}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => move(index, -1)}>
                  {strings.admin.moveUp}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => move(index, 1)}>
                  {strings.admin.moveDown}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setDays((current) => renumber(current.filter((_, i) => i !== index)))
                  }
                  disabled={days.length === 1}
                >
                  {strings.admin.removeDay}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor={`itinerary-day-${index}-title`} className="text-xs font-medium">
                  {strings.admin.dayTitle}
                </label>
                <input
                  id={`itinerary-day-${index}-title`}
                  value={day.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor={`itinerary-day-${index}-description`}
                  className="text-xs font-medium"
                >
                  {strings.admin.dayDescription}
                </label>
                <textarea
                  id={`itinerary-day-${index}-description`}
                  value={day.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  rows={3}
                  maxLength={2000}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor={`itinerary-day-${index}-destination`}
                  className="text-xs font-medium"
                >
                  {strings.admin.destination}
                </label>
                <select
                  id={`itinerary-day-${index}-destination`}
                  value={day.destinationId ?? ""}
                  onChange={(event) => update(index, { destinationId: event.target.value || null })}
                  className={inputClass}
                >
                  <option value="">{strings.admin.noDestination}</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={`itinerary-day-${index}-accommodation`}
                  className="text-xs font-medium"
                >
                  {strings.admin.accommodation}
                </label>
                <input
                  id={`itinerary-day-${index}-accommodation`}
                  value={day.accommodation}
                  onChange={(event) => update(index, { accommodation: event.target.value })}
                  maxLength={300}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`itinerary-day-${index}-meals`} className="text-xs font-medium">
                  {strings.admin.meals}
                </label>
                <input
                  id={`itinerary-day-${index}-meals`}
                  value={day.meals.join(", ")}
                  onChange={(event) =>
                    update(index, {
                      meals: event.target.value
                        .split(",")
                        .map((meal) => meal.trim())
                        .filter(Boolean),
                    })
                  }
                  className={inputClass}
                  placeholder={strings.admin.mealsHint}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setDays((current) => [
            ...current,
            {
              dayNumber: current.length + 1,
              title: "",
              description: "",
              destinationId: null,
              accommodation: "",
              meals: [],
            },
          ])
        }
      >
        {strings.admin.addDay}
      </Button>
    </div>
  );
}
