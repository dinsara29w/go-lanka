import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { deleteReviewAction } from "./actions";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  author_name: string;
  country: string | null;
  rating: number;
  title: string | null;
  is_verified: boolean;
  is_published: boolean;
  package_title: string;
};

export default async function AdminReviewsPage() {
  const session = await requireAdmin();
  const result = await getAdminPool().query<ReviewRow>(
    `SELECT r.id, r.author_name, r.country, r.rating, r.title,
            r.is_verified, r.is_published, p.title AS package_title
     FROM reviews r
     JOIN packages p ON p.id = r.package_id
     ORDER BY r.created_at DESC`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{strings.admin.reviews}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {strings.admin.reviews}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {strings.admin.reviewsIntro}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/reviews/new">{strings.admin.newReview}</Link>
        </Button>
      </div>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noReviews}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.authorName}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.packages}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.rating}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.status}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.author_name}</p>
                    <p className="text-xs text-muted-foreground">{row.country ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.package_title}</td>
                  <td className="px-4 py-3 text-xs">{row.rating} / 5</td>
                  <td className="px-4 py-3 text-xs">
                    {row.is_published ? strings.admin.published : strings.admin.draft}
                    {row.is_verified ? ` · ${strings.admin.verified}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/reviews/${row.id}`}>{strings.admin.editReview}</Link>
                      </Button>
                      <form action={deleteReviewAction}>
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
