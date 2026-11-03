import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { ReviewForm } from "../review-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type ReviewRow = {
  id: string;
  package_id: string;
  author_name: string;
  country: string | null;
  rating: number;
  title: string | null;
  body: string;
  is_verified: boolean;
  is_published: boolean;
};

export default async function AdminReviewEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";

  const packagesResult = await getAdminPool().query<{ id: string; title: string }>(
    "SELECT id, title FROM packages ORDER BY title ASC",
  );

  let initial = null;
  if (!isNew) {
    const result = await getAdminPool().query<ReviewRow>(
      `SELECT id, package_id, author_name, country, rating, title, body,
              is_verified, is_published
       FROM reviews WHERE id = $1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row) notFound();
    initial = {
      id: row.id,
      packageId: row.package_id,
      authorName: row.author_name,
      country: row.country,
      rating: row.rating,
      title: row.title,
      body: row.body,
      isVerified: row.is_verified,
      isPublished: row.is_published,
    };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.reviews}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isNew ? strings.admin.newReview : strings.admin.editReview}
        </h1>
      </div>

      <div className="max-w-3xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <ReviewForm
          csrfToken={session.csrfToken}
          packages={packagesResult.rows}
          initial={initial}
        />
      </div>
    </div>
  );
}
