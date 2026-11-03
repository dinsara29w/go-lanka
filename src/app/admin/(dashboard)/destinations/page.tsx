import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { deleteDestinationAction } from "./actions";

export const dynamic = "force-dynamic";

type DestinationRow = {
  id: string;
  name: string;
  slug: string;
  region: string;
};

export default async function AdminDestinationsPage() {
  const session = await requireAdmin();
  const result = await getAdminPool().query<DestinationRow>(
    `SELECT id, name, slug, region FROM destinations ORDER BY name ASC`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{strings.admin.destinations}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {strings.admin.destinations}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {strings.admin.destinationsIntro}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/destinations/new">{strings.admin.newDestination}</Link>
        </Button>
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noDestinations}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.name}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.region}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.region}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/destinations/${row.id}`}>
                          {strings.admin.editDestination}
                        </Link>
                      </Button>
                      <form action={deleteDestinationAction}>
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
