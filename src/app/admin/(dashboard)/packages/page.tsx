import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { formatDuration, formatLkr } from "@/lib/currency";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { deletePackageAction } from "./actions";

export const dynamic = "force-dynamic";

type PackageRow = {
  id: string;
  title: string;
  slug: string;
  duration_days: number;
  base_price_lkr: string;
  is_published: boolean;
  featured: boolean;
};

export default async function AdminPackagesPage() {
  const session = await requireAdmin();
  const result = await getAdminPool().query<PackageRow>(
    `SELECT id, title, slug, duration_days, base_price_lkr, is_published, featured
     FROM packages
     ORDER BY created_at DESC`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{strings.admin.packages}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {strings.admin.packages}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {strings.admin.packagesIntro}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">{strings.admin.newPackage}</Link>
        </Button>
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noPackages}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.title}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.durationDays}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.priceLkr}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.published}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{formatDuration(row.duration_days)}</td>
                  <td className="px-4 py-3 text-xs">{formatLkr(Number(row.base_price_lkr))}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.is_published ? strings.admin.published : strings.admin.draft}
                    {row.featured ? ` · ${strings.admin.featured}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/packages/${row.id}`}>{strings.admin.editPackage}</Link>
                      </Button>
                      <form action={deletePackageAction}>
                        <input type="hidden" name="_csrf" value={session.csrfToken} />
                        <input type="hidden" name="id" value={row.id} />
                        <ConfirmSubmitButton message={strings.admin.confirmDelete}>
                          {strings.admin.delete}
                        </ConfirmSubmitButton>
                      </form>
                    </div>
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
