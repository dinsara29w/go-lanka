"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import type { SiteSettings } from "@/server/repositories/site-settings";

import { saveSettingsAction, type SettingsActionState } from "../actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: SettingsActionState = {};

export function SettingsForm({
  csrfToken,
  settings,
}: {
  csrfToken: string;
  settings: SiteSettings | null;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="settings-whatsapp" className="text-sm font-medium">
            {strings.admin.whatsappNumber}
          </label>
          <input
            id="settings-whatsapp"
            name="whatsappNumber"
            type="tel"
            defaultValue={settings?.whatsappNumber ?? ""}
            className={inputClass}
            placeholder="+94..."
          />
        </div>
        <div>
          <label htmlFor="settings-phone" className="text-sm font-medium">
            {strings.admin.phone}
          </label>
          <input
            id="settings-phone"
            name="phone"
            type="tel"
            defaultValue={settings?.phone ?? ""}
            className={inputClass}
            placeholder="+94..."
          />
        </div>
      </div>

      <div>
        <label htmlFor="settings-email" className="text-sm font-medium">
          {strings.admin.contactEmail}
        </label>
        <input
          id="settings-email"
          name="contactEmail"
          type="email"
          defaultValue={settings?.contactEmail ?? ""}
          className={inputClass}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-sm font-semibold">{strings.admin.socialLinks}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="settings-facebook" className="text-sm font-medium">
              {strings.admin.facebook}
            </label>
            <input
              id="settings-facebook"
              name="facebook"
              type="url"
              defaultValue={settings?.socials.facebook ?? ""}
              className={inputClass}
              placeholder="https://"
            />
          </div>
          <div>
            <label htmlFor="settings-instagram" className="text-sm font-medium">
              {strings.admin.instagram}
            </label>
            <input
              id="settings-instagram"
              name="instagram"
              type="url"
              defaultValue={settings?.socials.instagram ?? ""}
              className={inputClass}
              placeholder="https://"
            />
          </div>
          <div>
            <label htmlFor="settings-youtube" className="text-sm font-medium">
              {strings.admin.youtube}
            </label>
            <input
              id="settings-youtube"
              name="youtube"
              type="url"
              defaultValue={settings?.socials.youtube ?? ""}
              className={inputClass}
              placeholder="https://"
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.saving : strings.admin.save}
      </Button>
    </form>
  );
}
