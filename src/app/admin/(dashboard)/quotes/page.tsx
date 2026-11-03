import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { formatLkr } from "@/lib/currency";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type QuoteListRow = {
  id: string;
  reference: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: "draft" | "pending_review" | "approved" | "rejected";
  total_lkr: string;
  final_total_lkr: string | null;
  package_title: string | null;
  created_at: Date;
};

const statusLabels: Record<QuoteListRow["status"], string> = {
  draft: strings.admin.statusDraft,
  pending_review: strings.admin.statusPendingReview,
  approved: strings.admin.statusApproved,
  rejected: strings.admin.statusRejected,
};

const statusClasses: Record<QuoteListRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-gold/20 text-ochre",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-destructive/10 text-destructive",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const validStatus = ["draft", "pending_review", "approved", "rejected"].includes(
    params.status ?? "",
  )
    ? (params.status as QuoteListRow["status"])
    : null;

  const result = await getAdminPool().query<QuoteListRow>(
    `SELECT id, reference, name, email, phone, status, total_lkr,
            final_total_lkr, package_title, created_at
     FROM tour_quotes
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC
     LIMIT 200`,
    [validStatus],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.quotes}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.quotes}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.quotesIntro}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quote-status-filter" className="text-xs font-medium">
            {strings.admin.quoteStatus}
          </label>
          <select
            id="quote-status-filter"
            name="status"
            defaultValue={validStatus ?? ""}
            className="mt-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="pending_review">{strings.admin.statusPendingReview}</option>
            <option value="approved">{strings.admin.statusApproved}</option>
            <option value="rejected">{strings.admin.statusRejected}</option>
            <option value="draft">{strings.admin.statusDraft}</option>
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          {strings.admin.filter}
        </Button>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noQuotes}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{strings.admin.reference}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.quoteCustomer}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.quotePackage}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.quoteStatus}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.quoteTotal}</th>
                <th className="px-4 py-3 font-medium">{strings.admin.quoteCreated}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs">{row.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.email ?? row.phone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.package_title ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[row.status]}`}
                    >
                      {statusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatLkr(Number(row.final_total_lkr ?? row.total_lkr))}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {dateFormatter.format(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/quotes/${row.id}`}>{strings.admin.viewQuote}</Link>
                    </Button>
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
