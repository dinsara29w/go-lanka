"use client";

import { useActionState } from "react";

import { ImageUploadField, GalleryEditor } from "@/components/admin/image-upload-field";
import { ItineraryEditor } from "@/components/admin/itinerary-editor";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { BUDGET_LABELS, BUDGET_TIERS } from "@/lib/tour-builder";
import type { AdminDestinationOption, AdminPackageData, AdminSaveState } from "@/lib/admin-types";

import { savePackageAction } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AdminSaveState = {};

export function PackageForm({
  csrfToken,
  destinations,
  initial,
}: {
  csrfToken: string;
  destinations: AdminDestinationOption[];
  initial: AdminPackageData | null;
}) {
  const [state, formAction, pending] = useActionState(savePackageAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="_csrf" value={csrfToken} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="package-title" className="text-sm font-medium">
            {strings.admin.title}
          </label>
          <input
            id="package-title"
            name="title"
            required
            maxLength={200}
            defaultValue={initial?.title ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="package-slug" className="text-sm font-medium">
            {strings.admin.slug}
          </label>
          <input
            id="package-slug"
            name="slug"
            required
            maxLength={120}
            defaultValue={initial?.slug ?? ""}
            className={inputClass}
            placeholder="seven-day-cultural-journey"
          />
        </div>
        <div>
          <label htmlFor="package-duration" className="text-sm font-medium">
            {strings.admin.durationDays}
          </label>
          <input
            id="package-duration"
            name="durationDays"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={initial?.durationDays ?? 7}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="package-summary" className="text-sm font-medium">
            {strings.admin.summary}
          </label>
          <textarea
            id="package-summary"
            name="summary"
            required
            rows={3}
            maxLength={2000}
            defaultValue={initial?.summary ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="package-price" className="text-sm font-medium">
            {strings.admin.priceLkr}
          </label>
          <input
            id="package-price"
            name="basePriceLkr"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={initial?.basePriceLkr ?? 0}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="package-daily-rate" className="text-sm font-medium">
            {strings.admin.dailyRateLkr}
          </label>
          <input
            id="package-daily-rate"
            name="dailyRateLkr"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={initial?.dailyRateLkr ?? 0}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">{strings.admin.dailyRateHint}</p>
        </div>
        <div>
          <label htmlFor="package-tier" className="text-sm font-medium">
            {strings.admin.budgetTier}
          </label>
          <select
            id="package-tier"
            name="tier"
            defaultValue={initial?.tier ?? "star"}
            className={inputClass}
          >
            {BUDGET_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {BUDGET_LABELS[tier]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 pt-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={initial?.isPublished ?? false}
            />
            {strings.admin.published}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? false} />
            {strings.admin.featured}
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="package-activities" className="text-sm font-medium">
          {strings.admin.activities}
        </label>
        <textarea
          id="package-activities"
          name="activities"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.activities.join("\n") ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">{strings.admin.itemsHint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="package-inclusions" className="text-sm font-medium">
            {strings.admin.inclusions}
          </label>
          <textarea
            id="package-inclusions"
            name="inclusions"
            rows={4}
            maxLength={4000}
            defaultValue={initial?.inclusions.join("\n") ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">{strings.admin.itemsHint}</p>
        </div>
        <div>
          <label htmlFor="package-exclusions" className="text-sm font-medium">
            {strings.admin.exclusions}
          </label>
          <textarea
            id="package-exclusions"
            name="exclusions"
            rows={4}
            maxLength={4000}
            defaultValue={initial?.exclusions.join("\n") ?? ""}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">{strings.admin.itemsHint}</p>
        </div>
      </div>

      <div>
        <label htmlFor="package-destinations" className="text-sm font-medium">
          {strings.admin.destinations}
        </label>
        <select
          id="package-destinations"
          name="destinationIds"
          multiple
          size={Math.min(Math.max(destinations.length, 3), 8)}
          defaultValue={initial?.destinationIds ?? []}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {destinations.map((destination) => (
            <option key={destination.id} value={destination.id}>
              {destination.name} · {destination.region}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{strings.admin.destinationsHint}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">{strings.admin.image}</p>
        <div className="mt-3">
          <ImageUploadField
            name="heroImage"
            altName="heroImageAlt"
            category="packages"
            csrfToken={csrfToken}
            initialUrl={initial?.heroImage}
            initialAlt={initial?.heroImageAlt}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <GalleryEditor
          name="gallery"
          category="packages"
          csrfToken={csrfToken}
          initialImages={initial?.gallery ?? []}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <ItineraryEditor
          name="itinerary"
          initialDays={initial?.itinerary ?? []}
          destinations={destinations}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.savingPackage : strings.admin.savePackage}
      </Button>
    </form>
  );
}
