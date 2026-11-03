"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

import { saveTravelInfoAction, type TravelActionState } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

type Faq = { question: string; answer: string };

function FaqEditor({ initial }: { initial: Faq[] }) {
  const [faqs, setFaqs] = useState<Faq[]>(initial);

  return (
    <div className="space-y-3">
      <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
      <p className="text-sm font-medium">{strings.admin.travelFaqs}</p>
      {faqs.map((faq, index) => (
        <div key={index} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">FAQ {index + 1}</p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setFaqs((current) => current.filter((_, i) => i !== index))}
            >
              {strings.admin.removeFaq}
            </Button>
          </div>
          <input
            value={faq.question}
            onChange={(event) =>
              setFaqs((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, question: event.target.value } : item,
                ),
              )
            }
            placeholder={strings.admin.question}
            className={inputClass}
            maxLength={300}
          />
          <textarea
            value={faq.answer}
            onChange={(event) =>
              setFaqs((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, answer: event.target.value } : item,
                ),
              )
            }
            placeholder={strings.admin.answer}
            rows={3}
            className={inputClass}
            maxLength={3000}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => setFaqs((current) => [...current, { question: "", answer: "" }])}
      >
        {strings.admin.addFaq}
      </Button>
    </div>
  );
}

const initialState: TravelActionState = {};

export function TravelInfoForm({
  csrfToken,
  initial,
}: {
  csrfToken: string;
  initial: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    body: string;
    bullets: string[];
    faqs: Faq[];
    sortOrder: number;
    isPublished: boolean;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(saveTravelInfoAction, initialState);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="travel-title" className="text-sm font-medium">
            {strings.admin.travelSectionTitle}
          </label>
          <input
            id="travel-title"
            name="title"
            required
            maxLength={200}
            defaultValue={initial?.title ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="travel-slug" className="text-sm font-medium">
            {strings.admin.slug}
          </label>
          <input
            id="travel-slug"
            name="slug"
            required
            maxLength={120}
            defaultValue={initial?.slug ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="travel-sort" className="text-sm font-medium">
            {strings.admin.sortOrder}
          </label>
          <input
            id="travel-sort"
            name="sortOrder"
            type="number"
            min={0}
            max={1000}
            defaultValue={initial?.sortOrder ?? 0}
            className={inputClass}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
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
        <label htmlFor="travel-summary" className="text-sm font-medium">
          {strings.admin.travelSectionSummary}
        </label>
        <textarea
          id="travel-summary"
          name="summary"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.summary ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="travel-body" className="text-sm font-medium">
          {strings.admin.travelBody}
        </label>
        <textarea
          id="travel-body"
          name="body"
          required
          rows={8}
          maxLength={10000}
          defaultValue={initial?.body ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="travel-bullets" className="text-sm font-medium">
          {strings.admin.travelBullets}
        </label>
        <textarea
          id="travel-bullets"
          name="bullets"
          rows={4}
          maxLength={5000}
          defaultValue={initial?.bullets.join("\n") ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-foreground">{strings.admin.itemsHint}</p>
      </div>

      <FaqEditor initial={initial?.faqs ?? []} />

      <Button type="submit" disabled={pending}>
        {pending ? strings.admin.savingTravelSection : strings.admin.saveTravelSection}
      </Button>
    </form>
  );
}
