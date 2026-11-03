import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
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
  room_only_percent: string;
  half_board_percent: string;
  full_board_percent: string;
  child_rate_percent: string;
};

type VehicleRow = {
  id: string;
  name: string;
  min_pax: number;
  max_pax: number;
  per_km_rate_lkr: string;
  driver_daily_rate_lkr: string;
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
      `SELECT admin_whatsapp_number, room_only_percent, half_board_percent,
              full_board_percent, child_rate_percent
       FROM tour_builder_settings WHERE singleton = true LIMIT 1`,
    ),
    getAdminPool().query<VehicleRow>(
      `SELECT id, name, min_pax, max_pax, per_km_rate_lkr,
              driver_daily_rate_lkr, is_active
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
        <h2 className="font-heading text-xl font-semibold">
          {strings.admin.tourBuilderSettings}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {strings.admin.tourBuilderSettingsIntro}
        </p>

        <form action={saveTourRatesAction} className="mt-5 space-y-4">
          <input type="hidden" name="_csrf" value={session.csrfToken} />
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
                className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
              >
                <input type="hidden" name="_csrf" value={session.csrfToken} />
                <input type="hidden" name="id" value={vehicle.id} />
                <div className="lg:col-span-2">
                  <label htmlFor={`vehicle-name-${vehicle.id}`} className="text-xs font-medium">
                    {strings.admin.vehicleName}
                  </label>
                  <input
                    id={`vehicle-name-${vehicle.id}`}
                    name="name"
                    required
                    defaultValue={vehicle.name}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`vehicle-min-${vehicle.id}`} className="text-xs font-medium">
                    {strings.admin.minPax}
                  </label>
                  <input
                    id={`vehicle-min-${vehicle.id}`}
                    name="minPax"
                    type="number"
                    min={1}
                    max={60}
                    required
                    defaultValue={vehicle.min_pax}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`vehicle-max-${vehicle.id}`} className="text-xs font-medium">
                    {strings.admin.maxPax}
                  </label>
                  <input
                    id={`vehicle-max-${vehicle.id}`}
                    name="maxPax"
                    type="number"
                    min={1}
                    max={60}
                    required
                    defaultValue={vehicle.max_pax}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`vehicle-km-${vehicle.id}`} className="text-xs font-medium">
                    {strings.admin.perKmRate}
                  </label>
                  <input
                    id={`vehicle-km-${vehicle.id}`}
                    name="perKmRateLkr"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={Number(vehicle.per_km_rate_lkr)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={`vehicle-driver-${vehicle.id}`} className="text-xs font-medium">
                    {strings.admin.driverDailyRate}
                  </label>
                  <input
                    id={`vehicle-driver-${vehicle.id}`}
                    name="driverDailyRateLkr"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={Number(vehicle.driver_daily_rate_lkr)}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={vehicle.is_active} />
                  {strings.admin.active}
                </label>
                <div className="flex gap-2 lg:col-span-2">
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
          className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
        >
          <input type="hidden" name="_csrf" value={session.csrfToken} />
          <div className="lg:col-span-2">
            <label htmlFor="new-vehicle-name" className="text-xs font-medium">
              {strings.admin.vehicleName}
            </label>
            <input
              id="new-vehicle-name"
              name="name"
              required
              className={inputClass}
              placeholder="Toyota HiAce"
            />
          </div>
          <div>
            <label htmlFor="new-vehicle-min" className="text-xs font-medium">
              {strings.admin.minPax}
            </label>
            <input
              id="new-vehicle-min"
              name="minPax"
              type="number"
              min={1}
              max={60}
              required
              defaultValue={1}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-vehicle-max" className="text-xs font-medium">
              {strings.admin.maxPax}
            </label>
            <input
              id="new-vehicle-max"
              name="maxPax"
              type="number"
              min={1}
              max={60}
              required
              defaultValue={4}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-vehicle-km" className="text-xs font-medium">
              {strings.admin.perKmRate}
            </label>
            <input
              id="new-vehicle-km"
              name="perKmRateLkr"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={0}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-vehicle-driver" className="text-xs font-medium">
              {strings.admin.driverDailyRate}
            </label>
            <input
              id="new-vehicle-driver"
              name="driverDailyRateLkr"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={0}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked />
            {strings.admin.active}
          </label>
          <div className="lg:col-span-2">
            <Button type="submit" size="sm">
              {strings.admin.addVehicle}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
