import "server-only";

import { getPublicPool } from "@/server/db/pools";

export type TravelFaq = {
  question: string;
  answer: string;
};

export type PublicTravelSection = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  bullets: string[];
  faqs: TravelFaq[];
  updatedAt: Date;
};

type TravelRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: unknown;
  faqs: unknown;
  updated_at: Date;
};

function asFaqs(value: unknown): TravelFaq[] {
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

function asContent(value: unknown): { body: string; bullets: string[] } {
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

export async function listPublishedTravelInfo(): Promise<PublicTravelSection[]> {
  const result = await getPublicPool().query<TravelRow>(
    `SELECT id, slug, title, summary, content, faqs, updated_at
     FROM travel_info_sections
     WHERE is_published = true
     ORDER BY sort_order ASC, title ASC`,
  );

  return result.rows.map((row) => {
    const content = asContent(row.content);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      body: content.body,
      bullets: content.bullets,
      faqs: asFaqs(row.faqs),
      updatedAt: row.updated_at,
    };
  });
}
