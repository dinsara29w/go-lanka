import { strings } from "@/content/strings";
import { requireOwner } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

type AuditRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
  actor_email: string | null;
  metadata: Record<string, unknown>;
};

export default async function AdminAuditPage() {
  await requireOwner();
  const result = await getAdminPool().query<AuditRow>(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
            u.email AS actor_email, a.metadata
     FROM admin_audit_log a
     LEFT JOIN admin_users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT 100`,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.audit}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.audit}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.auditIntro}
        </p>
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noAudit}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.time}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.actor}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.action}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.entity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {dateFormatter.format(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs">{row.actor_email ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.entity_type ?? "—"}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
