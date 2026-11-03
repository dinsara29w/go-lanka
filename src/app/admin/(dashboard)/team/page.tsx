import { strings } from "@/content/strings";
import { requireOwner } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { InviteAdminForm } from "./invite-admin-form";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

type AdminRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login_at: Date | null;
};

export default async function AdminTeamPage() {
  const session = await requireOwner();
  const result = await getAdminPool().query<AdminRow>(
    `SELECT id, email, role, is_active, mfa_enabled, last_login_at
     FROM admin_users
     ORDER BY created_at ASC`,
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.team}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{strings.admin.team}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.teamIntro}
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <InviteAdminForm csrfToken={session.csrfToken} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="divide-y divide-border">
          {result.rows.map((admin) => (
            <div
              key={admin.id}
              className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1 text-sm">
                <p className="font-medium">{admin.email}</p>
                <p className="text-xs text-muted-foreground">
                  {admin.role} ·{" "}
                  {admin.mfa_enabled ? strings.admin.mfaEnabled : strings.admin.mfaNotConfigured} ·{" "}
                  {admin.is_active ? strings.admin.active : strings.admin.inactive}
                </p>
                <p className="text-xs text-muted-foreground">
                  {strings.admin.lastLogin}:{" "}
                  {admin.last_login_at
                    ? dateFormatter.format(admin.last_login_at)
                    : strings.admin.never}
                </p>
              </div>
              {!admin.is_active ? (
                <span className="text-xs text-destructive">{strings.admin.inactive}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
