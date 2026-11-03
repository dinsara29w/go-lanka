import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAdminPool } from "@/server/db/pools";

import { TravelInfoForm } from "../travel-info-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SectionRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: unknown;
  faqs: unknown;
  sort_order: number;
  is_published: boolean;
};

function parseContent(value: unknown): { body: string; bullets: string[] } {
  if (typeof value !== "object" || value === null) return { body: "", bullets: [] };
  const body = (value as { body?: unknown }).body;
  const bullets = (value as { bullets?: unknown }).bullets;
  return {
    body: typeof body === "string" ? body : "",
    bullets: Array.isArray(bullets)
      ? bullets.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function parseFaqs(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { question: string; answer: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { question?: unknown }).question === "string" &&
        typeof (item as { answer?: unknown }).answer === "string",
    )
    .map((item) => ({ question: item.question, answer: item.answer }));
}

export default async function AdminTravelInfoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";

  let initial = null;
  if (!isNew) {
    const result = await getAdminPool().query<SectionRow>(
      `SELECT id, slug, title, summary, content, faqs, sort_order, is_published
       FROM travel_info_sections WHERE id = $1::uuid`,
      [id],
    );
    const row = result.rows[0];
    if (!row) notFound();
    const content = parseContent(row.content);
    initial = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: content.body,
      bullets: content.bullets,
      faqs: parseFaqs(row.faqs),
      sortOrder: row.sort_order,
      isPublished: row.is_published,
    };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{strings.admin.travelInfo}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {isNew ? strings.admin.newTravelSection : strings.admin.editTravelSection}
        </h1>
      </div>

      <div className="max-w-4xl rounded-xl border border-border bg-card p-5 sm:p-6">
        <TravelInfoForm csrfToken={session.csrfToken} initial={initial} />
      </div>
    </div>
  );
}
