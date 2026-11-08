import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { VEHICLE_MODE_LABELS, VEHICLE_MODES, type VehicleMode } from "@/lib/tour-builder";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { deleteVehicleAction, saveTourRatesAction, saveVehicleAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SettingsRow = {
  admin_whatsapp_number: string | null;
  economy_rate_lkr: string;
  star_rate_lkr: string;
  luxury_rate_lkr: string;
  room_only_percent: string;
  half_board_percent: string;
  full_board_percent: string;
  child_rate_percent: string;
};

type VehicleRow = {
  id: string;
  name: string;
  mode: VehicleMode;
  min_pax: number;
  max_pax: number;
  per_km_rate_lkr: string;
  daily_rate_lkr: string;
  included_km_per_day: number;
  is_active: boolean;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export default async function AdminRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const [settingsResult, vehicleResult] = await Promise.all([
    getAdminPool().query<SettingsRow>(
      `SELECT admin_whatsapp_number, economy_rate_lkr, star_rate_lkr, luxury_rate_lkr,
              room_only_percent, half_board_percent, full_board_percent, child_rate_percent
       FROM tour_builder_settings WHERE singleton = true LIMIT 1`,
    ),
    getAdminPool().query<VehicleRow>(
      `SELECT id, name, mode, min_pax, max_pax, per_km_rate_lkr,
              daily_rate_lkr, included_km_per_day, is_active
       FROM vehicles ORDER BY sort_order ASC, max_pax ASC, name ASC`,
    ),
  ]);
  const settings = settingsResult.rows[0];
  const vehicles = vehicleResult.rows;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.rates}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.rates}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.ratesIntro}
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {strings.admin.ratesSaved}
        </div>
      ) : null}
      {params.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Please check the values and try again.
        </div>
      ) : null}

      <section className="max-w-3xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold">{strings.admin.tourBuilderSettings}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {strings.admin.tourBuilderSettingsIntro}
        </p>

        <form action={saveTourRatesAction} className="mt-5 space-y-4">
          <input type="hidden" name="_csrf" value={session.csrfToken} />
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["economyRateLkr", strings.admin.economyRate, settings?.economy_rate_lkr, 15000],
                ["starRateLkr", strings.admin.starRate, settings?.star_rate_lkr, 60000],
                ["luxuryRateLkr", strings.admin.luxuryRate, settings?.luxury_rate_lkr, 125000],
              ] as const
            ).map(([name, label, value, fallback]) => (
              <div key={name}>
                <label htmlFor={`rates-${name}`} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`rates-${name}`}
                  name={name}
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={value !== undefined ? Number(value) : fallback}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rates-room-only" className="text-sm font-medium">
                {strings.admin.roomOnlyPercent}
              </label>
              <input
                id="rates-room-only"
                name="roomOnlyPercent"
                type="number"
                step="0.01"
                required
                defaultValue={settings ? Number(settings.room_only_percent) : -10}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rates-half-board" className="text-sm font-medium">
                {strings.admin.halfBoardPercent}
              </label>
              <input
                id="rates-half-board"
                name="halfBoardPercent"
                type="number"
                step="0.01"
                required
                defaultValue={settings ? Number(settings.half_board_percent) : 5}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rates-full-board" className="text-sm font-medium">
                {strings.admin.fullBoardPercent}
              </label>
              <input
                id="rates-full-board"
                name="fullBoardPercent"
                type="number"
                step="0.01"
                required
                defaultValue={settings ? Number(settings.full_board_percent) : 10}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="rates-child" className="text-sm font-medium">
                {strings.admin.childRatePercent}
              </label>
              <input
                id="rates-child"
                name="childRatePercent"
                type="number"
                step="0.01"
                min={0}
                max={100}
                required
                defaultValue={settings ? Number(settings.child_rate_percent) : 50}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rates-admin-whatsapp" className="text-sm font-medium">
                {strings.admin.adminWhatsAppNumber}
              </label>
              <input
                id="rates-admin-whatsapp"
                name="adminWhatsAppNumber"
                type="tel"
                defaultValue={settings?.admin_whatsapp_number ?? ""}
                className={inputClass}
                placeholder="+94..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {strings.admin.adminWhatsAppHint}
              </p>
            </div>
          </div>
          <Button type="submit">{strings.admin.saveRates}</Button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-semibold">{strings.admin.vehicles}</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {strings.admin.vehiclesIntro}
          </p>
        </div>

        {vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            {strings.admin.noVehicles}
          </p>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <form
                key={vehicle.id}
                action={saveVehicleAction}
                className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
              >
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={vehicle.id} />
                <VehicleFields idPrefix={vehicle.id} vehicle={vehicle} />
                <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                  <Button type="submit" size="sm">
                    {strings.admin.saveVehicle}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    formAction={deleteVehicleAction}
                  >
                    {strings.admin.deleteVehicle}
                  </Button>
                </div>
              </form>
            ))}
          </div>
        )}

        <form
          action={saveVehicleAction}
          className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
        >
          <input type="hidden" name="_csrf" value={session.csrfToken} />
          <VehicleFields idPrefix="new" vehicle={null} />
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm">
              {strings.admin.addVehicle}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function VehicleFields({ idPrefix, vehicle }: { idPrefix: string; vehicle: VehicleRow | null }) {
  const field = (name: string) => `vehicle-${name}-${idPrefix}`;
  return (
    <>
      <div>
        <label htmlFor={field("name")} className="text-xs font-medium">
          {strings.admin.vehicleName}
        </label>
        <input
          id={field("name")}
          name="name"
          required
          defaultValue={vehicle?.name ?? ""}
          placeholder="Van"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={field("mode")} className="text-xs font-medium">
          {strings.admin.vehicleMode}
        </label>
        <select
          id={field("mode")}
          name="mode"
          defaultValue={vehicle?.mode ?? "driver"}
          className={inputClass}
        >
          {VEHICLE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {VEHICLE_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={field("min")} className="text-xs font-medium">
          {strings.admin.minPax}
        </label>
        <input
          id={field("min")}
          name="minPax"
          type="number"
          min={1}
          max={60}
          required
          defaultValue={vehicle?.min_pax ?? 1}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={field("max")} className="text-xs font-medium">
          {strings.admin.maxPax}
        </label>
        <input
          id={field("max")}
          name="maxPax"
          type="number"
          min={1}
          max={60}
          required
          defaultValue={vehicle?.max_pax ?? 4}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={field("km")} className="text-xs font-medium">
          {strings.admin.perKmRate}
        </label>
        <input
          id={field("km")}
          name="perKmRateLkr"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={vehicle ? Number(vehicle.per_km_rate_lkr) : 0}
          className={inputClass}
          aria-describedby={field("km-hint")}
        />
        <p id={field("km-hint")} className="mt-1 text-xs text-muted-foreground">
          {strings.admin.perKmRateHint}
        </p>
      </div>
      <div>
        <label htmlFor={field("daily")} className="text-xs font-medium">
          {strings.admin.driverDailyRate}
        </label>
        <input
          id={field("daily")}
          name="dailyRateLkr"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={vehicle ? Number(vehicle.daily_rate_lkr) : 0}
          className={inputClass}
          aria-describedby={field("daily-hint")}
        />
        <p id={field("daily-hint")} className="mt-1 text-xs text-muted-foreground">
          {strings.admin.vehicleDailyHint}
        </p>
      </div>
      <div>
        <label htmlFor={field("included")} className="text-xs font-medium">
          {strings.admin.includedKm}
        </label>
        <input
          id={field("included")}
          name="includedKmPerDay"
          type="number"
          min={0}
          max={2000}
          required
          defaultValue={vehicle?.included_km_per_day ?? 0}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2 self-center text-sm">
        <input type="checkbox" name="isActive" defaultChecked={vehicle?.is_active ?? true} />
        {strings.admin.active}
      </label>
    </>
  );
}
