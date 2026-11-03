import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getSiteSettings } from "@/server/repositories/site-settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.settings}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.settings}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.settingsIntro}
        </p>
      </div>

      <div className="max-w-3xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <SettingsForm csrfToken={session.csrfToken} settings={settings} />
      </div>
    </div>
  );
}
