import Image from "next/image";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { moderatePhotoAction } from "./actions";

export const dynamic = "force-dynamic";

type PhotoRow = {
  id: string;
  caption: string | null;
  alt_text: string | null;
  submitter_name: string | null;
  status: string;
  created_at: Date;
  package_title: string | null;
};

export default async function AdminPhotosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const result = await getAdminPool().query<PhotoRow>(
    `SELECT ps.id, ps.caption, ps.alt_text, ps.submitter_name, ps.status,
            ps.created_at, p.title AS package_title
     FROM photo_submissions ps
     LEFT JOIN packages p ON p.id = ps.package_id
     ORDER BY ps.created_at DESC`,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.photos}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {strings.admin.photos}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {strings.admin.photosIntro}
        </p>
      </div>

      {params.error === "alt" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {strings.admin.photoAltHint}
        </div>
      ) : null}

      {result.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          {strings.admin.noPhotos}
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {result.rows.map((photo) => (
            <article key={photo.id} className="rounded-2xl border border-border bg-card p-4">
              <Image
                src={`/admin/photos/${photo.id}/preview`}
                alt={photo.alt_text ?? photo.caption ?? "Photo submission"}
                width={600}
                height={400}
                unoptimized
                className="h-56 w-full rounded-xl object-cover"
              />
              <div className="mt-3 space-y-1 text-sm">
                <p className="font-medium">{photo.caption ?? "No caption"}</p>
                <p className="text-xs text-muted-foreground">
                  {strings.admin.submitter}: {photo.submitter_name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {strings.admin.packages}: {photo.package_title ?? "—"}
                </p>
                <p className="text-xs capitalize text-muted-foreground">{photo.status}</p>
              </div>

              {photo.status !== "approved" ? (
                <form action={moderatePhotoAction} className="mt-4 space-y-3">
                  <input type="hidden" name="_csrf" value={session.csrfToken} />
                  <input type="hidden" name="id" value={photo.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <div>
                    <label htmlFor={`photo-alt-${photo.id}`} className="text-xs font-medium">
                      {strings.admin.photoAlt}
                    </label>
                    <input
                      id={`photo-alt-${photo.id}`}
                      name="altText"
                      defaultValue={photo.alt_text ?? ""}
                      maxLength={200}
                      required
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder={strings.admin.photoAltHint}
                    />
                  </div>
                  <Button type="submit" size="sm">
                    {strings.admin.approvePhoto}
                  </Button>
                </form>
              ) : null}

              {photo.status !== "rejected" ? (
                <form action={moderatePhotoAction} className="mt-3">
                  <input type="hidden" name="_csrf" value={session.csrfToken} />
                  <input type="hidden" name="id" value={photo.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <ConfirmSubmitButton message={strings.admin.confirmRejectPhoto}>
                    {strings.admin.rejectPhoto}
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
