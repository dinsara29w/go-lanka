"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { setAvailabilityAction, type AvailabilityActionState } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AvailabilityActionState = {};

export function AvailabilityForm({
  csrfToken,
  packages,
  packageId,
  defaultStart,
  defaultEnd,
}: {
  csrfToken: string;
  packages: Array<{ id: string; title: string }>;
  packageId: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, formAction, pending] = useActionState(setAvailabilityAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="_csrf" value={csrfToken} />

      {state.ok && state.message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {state.message}
        </div>
      ) : null}
      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="availability-package" className="text-sm font-medium">
          {strings.admin.package}
        </label>
        <select
          id="availability-package"
          name="packageId"
          defaultValue={packageId}
          className={inputClass}
        >
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="availability-start" className="text-sm font-medium">
            {strings.admin.startDate}
          </label>
          <input
            id="availability-start"
            name="startDate"
            type="date"
            required
            defaultValue={defaultStart}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="availability-end" className="text-sm font-medium">
            {strings.admin.endDate}
          </label>
          <input
            id="availability-end"
            name="endDate"
            type="date"
            required
            defaultValue={defaultEnd}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="availability-capacity" className="text-sm font-medium">
            {strings.admin.capacity}
          </label>
          <input
            id="availability-capacity"
            name="capacity"
            type="number"
            min={1}
            max={1000}
            required
            defaultValue={10}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="availability-status" className="text-sm font-medium">
            {strings.admin.status}
          </label>
          <select id="availability-status" name="status" defaultValue="open" className={inputClass}>
            <option value="open">{strings.booking.available}</option>
            <option value="limited">{strings.booking.limited}</option>
            <option value="closed">{strings.booking.closed}</option>
          </select>
        </div>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        {strings.admin.availabilityWarning}
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.applyingAvailability : strings.admin.applyAvailability}
      </Button>
    </form>
  );
}
