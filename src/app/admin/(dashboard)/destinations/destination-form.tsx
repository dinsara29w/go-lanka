"use client";

import { useActionState } from "react";

import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { sriLankaMapRegions } from "@/content/map-regions";
import { strings } from "@/content/strings";
import type { AdminDestinationData, AdminSaveState } from "@/lib/admin-types";

import { saveDestinationAction } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: AdminSaveState = {};

export function DestinationForm({
  csrfToken,
  initial,
}: {
  csrfToken: string;
  initial: AdminDestinationData | null;
}) {
  const [state, formAction, pending] = useActionState(saveDestinationAction, initialState);

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
        <div>
          <label htmlFor="destination-name" className="text-sm font-medium">
            {strings.admin.name}
          </label>
          <input
            id="destination-name"
            name="name"
            required
            maxLength={160}
            defaultValue={initial?.name ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="destination-slug" className="text-sm font-medium">
            {strings.admin.slug}
          </label>
          <input
            id="destination-slug"
            name="slug"
            required
            maxLength={120}
            defaultValue={initial?.slug ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="destination-region" className="text-sm font-medium">
            {strings.admin.region}
          </label>
          <input
            id="destination-region"
            name="region"
            required
            maxLength={120}
            defaultValue={initial?.region ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="destination-map-region" className="text-sm font-medium">
            {strings.admin.mapRegionId}
          </label>
          <select
            id="destination-map-region"
            name="mapRegionId"
            required
            defaultValue={initial?.mapRegionId ?? ""}
            className={inputClass}
          >
            <option value="">Select a district</option>
            {sriLankaMapRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name} · {region.province}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="destination-description" className="text-sm font-medium">
          {strings.admin.description}
        </label>
        <textarea
          id="destination-description"
          name="description"
          required
          rows={5}
          maxLength={4000}
          defaultValue={initial?.description ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="destination-lat" className="text-sm font-medium">
            {strings.admin.latitude}
          </label>
          <input
            id="destination-lat"
            name="lat"
            type="number"
            step="0.000001"
            min={-90}
            max={90}
            defaultValue={initial?.lat ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="destination-lng" className="text-sm font-medium">
            {strings.admin.longitude}
          </label>
          <input
            id="destination-lng"
            name="lng"
            type="number"
            step="0.000001"
            min={-180}
            max={180}
            defaultValue={initial?.lng ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="destination-season" className="text-sm font-medium">
            {strings.admin.bestSeason}
          </label>
          <input
            id="destination-season"
            name="bestSeason"
            maxLength={200}
            defaultValue={initial?.bestSeason ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="destination-highlights" className="text-sm font-medium">
          {strings.admin.highlights}
        </label>
        <textarea
          id="destination-highlights"
          name="highlights"
          rows={4}
          maxLength={4000}
          defaultValue={initial?.highlights.join("\n") ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">{strings.admin.itemsHint}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <ImageUploadField
          name="heroImage"
          altName="heroImageAlt"
          category="destinations"
          csrfToken={csrfToken}
          initialUrl={initial?.heroImage}
          initialAlt={initial?.heroImageAlt}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.savingDestination : strings.admin.saveDestination}
      </Button>
    </form>
  );
}
