"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { saveReviewAction, type ReviewActionState } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const initialState: ReviewActionState = {};

export function ReviewForm({
  csrfToken,
  packages,
  initial,
}: {
  csrfToken: string;
  packages: Array<{ id: string; title: string }>;
  initial: {
    id: string;
    packageId: string;
    authorName: string;
    country: string | null;
    rating: number;
    title: string | null;
    body: string;
    isVerified: boolean;
    isPublished: boolean;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(saveReviewAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="_csrf" value={csrfToken} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="review-package" className="text-sm font-medium">
          {strings.admin.packages}
        </label>
        <select
          id="review-package"
          name="packageId"
          defaultValue={initial?.packageId ?? ""}
          required
          className={inputClass}
        >
          <option value="">Select a package</option>
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="review-author" className="text-sm font-medium">
            {strings.admin.authorName}
          </label>
          <input
            id="review-author"
            name="authorName"
            required
            maxLength={200}
            defaultValue={initial?.authorName ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="review-country" className="text-sm font-medium">
            {strings.admin.authorCountry}
          </label>
          <input
            id="review-country"
            name="country"
            maxLength={120}
            defaultValue={initial?.country ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="review-rating" className="text-sm font-medium">
            {strings.admin.rating}
          </label>
          <select
            id="review-rating"
            name="rating"
            defaultValue={String(initial?.rating ?? 5)}
            className={inputClass}
          >
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} / 5
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 pt-7 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isVerified"
              defaultChecked={initial?.isVerified ?? false}
            />
            {strings.admin.verified}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={initial?.isPublished ?? false}
            />
            {strings.admin.published}
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="review-title" className="text-sm font-medium">
          {strings.admin.reviewTitle}
        </label>
        <input
          id="review-title"
          name="title"
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="review-body" className="text-sm font-medium">
          {strings.admin.reviewBody}
        </label>
        <textarea
          id="review-body"
          name="body"
          required
          rows={6}
          maxLength={5000}
          defaultValue={initial?.body ?? ""}
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.savingReview : strings.admin.saveReview}
      </Button>
    </form>
  );
}
