import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { formatLkr } from "@/lib/currency";
import { BOARD_LABELS, type BoardType, type BudgetTier } from "@/lib/tour-builder";
import type { GeneratedItinerary } from "@/lib/validation/tour-builder";
import { describeRide, describeStay, type QuoteBreakdown } from "@/server/ai/pricing";
import type { TourBuilderDestination } from "@/server/ai/context";

export type PdfQuiz = {
  locations: string[];
  budget: BudgetTier;
  board: BoardType;
  selfDrive: boolean;
  days: number;
  nights: number;
  adults: number;
  children: number;
  travelMonth: number;
  notes?: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.12, 0.16, 0.2);
const MUTED = rgb(0.42, 0.46, 0.5);
const ACCENT = rgb(0.17, 0.42, 0.55);
const LIGHT = rgb(0.91, 0.95, 0.96);

function safeText(value: string): string {
  return value
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function generateItineraryPdf(input: {
  quiz: PdfQuiz;
  itinerary: GeneratedItinerary;
  breakdown: QuoteBreakdown;
  totalLkr: number;
  reference: string;
  packageTitle: string;
  destinations: TourBuilderDestination[];
  adminNotes?: string | null;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const destinationName = new Map(
    input.destinations.map((destination) => [destination.slug, destination.name]),
  );

  pdf.setTitle(safeText(input.itinerary.title));
  pdf.setAuthor("Go Lanka");
  pdf.setSubject(`Quotation ${input.reference}`);
  pdf.setCreator("Go Lanka tour builder");

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 190,
    width: PAGE_WIDTH,
    height: 190,
    color: ACCENT,
  });
  page.drawText("GO LANKA", {
    x: MARGIN,
    y: PAGE_HEIGHT - 62,
    size: 11,
    font: bold,
    color: rgb(0.87, 0.94, 0.97),
  });
  page.drawText(input.reference, {
    x: PAGE_WIDTH - MARGIN - 100,
    y: PAGE_HEIGHT - 62,
    size: 11,
    font: bold,
    color: rgb(0.87, 0.94, 0.97),
  });
  const titleLines = wrapText(input.itinerary.title, bold, 26, CONTENT_WIDTH);
  titleLines.slice(0, 3).forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN,
      y: PAGE_HEIGHT - 105 - index * 32,
      size: 26,
      font: bold,
      color: rgb(1, 1, 1),
    });
  });
  y = PAGE_HEIGHT - 230;

  const summaryLines = wrapText(input.itinerary.summary, regular, 11, CONTENT_WIDTH);
  for (const line of summaryLines) {
    page.drawText(line, { x: MARGIN, y, size: 11, font: regular, color: INK });
    y -= 16;
  }

  y -= 12;
  page.drawRectangle({
    x: MARGIN,
    y: y - 64,
    width: CONTENT_WIDTH,
    height: 64,
    color: LIGHT,
  });
  const stats = [
    [
      "Duration",
      `${input.quiz.days} day${input.quiz.days === 1 ? "" : "s"} / ${input.quiz.nights} night${input.quiz.nights === 1 ? "" : "s"}`,
    ],
    [
      "Travellers",
      `${input.quiz.adults} adult${input.quiz.adults === 1 ? "" : "s"}${input.quiz.children ? `, ${input.quiz.children} child${input.quiz.children === 1 ? "" : "ren"}` : ""}`,
    ],
    ["Board", BOARD_LABELS[input.quiz.board]],
  ];
  stats.forEach(([label, value], index) => {
    const x = MARGIN + 14 + index * 165;
    page.drawText(label.toUpperCase(), {
      x,
      y: y - 22,
      size: 7,
      font: bold,
      color: MUTED,
    });
    page.drawText(safeText(value ?? ""), {
      x,
      y: y - 43,
      size: 11,
      font: bold,
      color: INK,
    });
  });
  y -= 90;

  page.drawText("Your itinerary", {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
    color: INK,
  });
  y -= 24;

  for (const day of input.itinerary.days) {
    const notesLines = day.notes ? wrapText(day.notes, regular, 9, CONTENT_WIDTH - 24) : [];
    const activityText = day.activities.join(" · ");
    const blockHeight = 132 + notesLines.length * 13;
    if (y - blockHeight < MARGIN + 28) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawRectangle({
      x: MARGIN,
      y: y - blockHeight,
      width: CONTENT_WIDTH,
      height: blockHeight,
      color: rgb(0.97, 0.975, 0.97),
      borderColor: rgb(0.88, 0.9, 0.88),
      borderWidth: 0.6,
    });
    page.drawText(`DAY ${day.day}`, {
      x: MARGIN + 14,
      y: y - 22,
      size: 8,
      font: bold,
      color: ACCENT,
    });
    const dayTitle = wrapText(day.title, bold, 13, CONTENT_WIDTH - 160);
    dayTitle.slice(0, 2).forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + 14,
        y: y - 41 - index * 16,
        size: 13,
        font: bold,
        color: INK,
      });
    });
    page.drawText(safeText(destinationName.get(day.destination_slug) ?? day.destination_slug), {
      x: PAGE_WIDTH - MARGIN - 150,
      y: y - 22,
      size: 9,
      font: regular,
      color: MUTED,
    });
    if (activityText) {
      const activityLines = wrapText(activityText, regular, 9, CONTENT_WIDTH - 28);
      page.drawText(activityLines[0] ?? "", {
        x: MARGIN + 14,
        y: y - 73,
        size: 9,
        font: regular,
        color: MUTED,
      });
    }
    if (day.overnight) {
      page.drawText(`Overnight: ${safeText(day.overnight)}`, {
        x: MARGIN + 14,
        y: y - 88,
        size: 9,
        font: regular,
        color: MUTED,
      });
    }
    if (day.travel_km > 0) {
      page.drawText(`Drive: ${Math.round(day.travel_km)} km`, {
        x: PAGE_WIDTH - MARGIN - 150,
        y: y - 88,
        size: 9,
        font: regular,
        color: MUTED,
      });
    }
    notesLines.forEach((line, index) => {
      page.drawText(line, {
        x: MARGIN + 14,
        y: y - 104 - index * 13,
        size: 9,
        font: regular,
        color: MUTED,
      });
    });

    y -= blockHeight + 12;
  }

  // Quotation summary.
  const breakdown = input.breakdown;
  const quoteLines: Array<[string, string]> = breakdown.stay
    ? [
        ["Hotels", describeStay(breakdown)],
        ["Transport", describeRide(breakdown)],
      ]
    : [["Pricing", "Confirmed by the team"]];

  const estimatedHeight = 120 + quoteLines.length * 30;
  if (y < MARGIN + estimatedHeight) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  page.drawText("Your quotation", {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
    color: INK,
  });
  y -= 26;

  for (const [label, value] of quoteLines) {
    page.drawText(label.toUpperCase(), {
      x: MARGIN,
      y,
      size: 7,
      font: bold,
      color: MUTED,
    });
    y -= 13;
    for (const line of wrapText(value, regular, 10, CONTENT_WIDTH)) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: INK });
      y -= 14;
    }
    y -= 6;
  }

  page.drawText("Total", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: MUTED,
  });
  page.drawText(safeText(formatLkr(input.totalLkr)), {
    x: MARGIN,
    y: y - 26,
    size: 22,
    font: bold,
    color: ACCENT,
  });
  y -= 46;

  const note = wrapText(
    "Prices are quoted in LKR and include the package, selected board basis and the estimated transport distance. The team confirms availability and the final details before booking.",
    regular,
    9,
    CONTENT_WIDTH,
  );
  for (const line of note) {
    page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 13;
  }

  if (input.adminNotes) {
    y -= 8;
    for (const line of wrapText(input.adminNotes, regular, 9, CONTENT_WIDTH)) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: INK });
      y -= 13;
    }
  }

  page.drawText(`Package: ${safeText(input.packageTitle)}`, {
    x: MARGIN,
    y: Math.max(y - 8, MARGIN + 30),
    size: 8,
    font: regular,
    color: MUTED,
  });

  const disclaimer = wrapText(
    "This is an AI-assisted itinerary reviewed by the local team. Destinations, hotels, activities and availability are subject to confirmation before booking.",
    regular,
    8,
    CONTENT_WIDTH,
  );
  let disclaimerY = MARGIN + 22 + disclaimer.length * 11;
  if (y < disclaimerY) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }
  disclaimerY = Math.max(y, MARGIN + 40);
  for (const line of disclaimer) {
    page.drawText(line, { x: MARGIN, y: disclaimerY, size: 8, font: regular, color: MUTED });
    disclaimerY -= 11;
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`${index + 1} / ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 30,
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return Buffer.from(await pdf.save());
}
