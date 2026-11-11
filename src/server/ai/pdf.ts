import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import { formatLkr } from "@/lib/currency";
import { BOARD_LABELS, BUDGET_LABELS, type BoardType, type BudgetTier } from "@/lib/tour-builder";
import type { GeneratedItinerary } from "@/lib/validation/tour-builder";
import { findMainPlace } from "@/content/places";
import { projectSriLankaPoint, sriLankaMapRegions } from "@/content/map-regions";
import { describeRide, describeStay, type QuoteBreakdown } from "@/server/ai/pricing";
import type { TourBuilderDestination } from "@/server/ai/context";
import { readImageForPdf, readLogoForPdf } from "@/server/storage/local";

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
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 56;

const INK = rgb(0.06, 0.16, 0.22);
const MUTED = rgb(0.38, 0.45, 0.5);
const BRAND = rgb(0.1, 0.36, 0.52);
const TEAL = rgb(0.07, 0.5, 0.52);
const GOLD = rgb(0.96, 0.72, 0.16);
const NAVY = rgb(0.04, 0.16, 0.24);
const TINT = rgb(0.92, 0.96, 0.97);
const LINE = rgb(0.84, 0.89, 0.91);
const WHITE = rgb(1, 1, 1);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function safeText(value: string): string {
  return value
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("×", "x")
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

/** Stops in travel order: consecutive days in the same place count as one stop. */
export type RouteStop = {
  slug: string;
  name: string;
  region: string;
  lat: number | null;
  lng: number | null;
  /** Kilometres driven to reach this stop (0 for the first). */
  legKm: number;
  nights: number;
};

export function buildRouteStops(
  itinerary: GeneratedItinerary,
  destinations: TourBuilderDestination[],
): RouteStop[] {
  const bySlug = new Map(destinations.map((item) => [item.slug, item]));
  const stops: RouteStop[] = [];
  for (const day of itinerary.days) {
    const last = stops.at(-1);
    if (last && last.slug === day.destination_slug) {
      last.nights += 1;
      continue;
    }
    const place = bySlug.get(day.destination_slug);
    stops.push({
      slug: day.destination_slug,
      name: place?.name ?? day.destination_slug,
      region: place?.region ?? "",
      lat: place?.lat ?? findMainPlace(day.destination_slug)?.lat ?? null,
      lng: place?.lng ?? findMainPlace(day.destination_slug)?.lng ?? null,
      legKm: stops.length === 0 ? 0 : day.travel_km,
      nights: 1,
    });
  }
  return stops;
}

type Fonts = { regular: PDFFont; bold: PDFFont; oblique: PDFFont };

export async function generateItineraryPdf(input: {
  quiz: PdfQuiz;
  itinerary: GeneratedItinerary;
  breakdown: QuoteBreakdown;
  totalLkr: number;
  reference: string;
  packageTitle?: string | null;
  destinations: TourBuilderDestination[];
  adminNotes?: string | null;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Go Lanka quotation ${input.reference}`);
  pdf.setAuthor("Go Lanka");
  pdf.setSubject(input.itinerary.title);
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    oblique: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const { regular, bold } = fonts;

  const stops = buildRouteStops(input.itinerary, input.destinations);
  const bySlug = new Map(input.destinations.map((item) => [item.slug, item]));
  const distanceKm = Math.round(input.itinerary.days.reduce((sum, d) => sum + d.travel_km, 0));
  const travellers = input.quiz.adults + input.quiz.children;
  const travellerText =
    `${input.quiz.adults} adult${input.quiz.adults === 1 ? "" : "s"}` +
    (input.quiz.children > 0
      ? `, ${input.quiz.children} child${input.quiz.children === 1 ? "" : "ren"}`
      : "");

  async function embedJpg(src: string | null | undefined, w: number, h: number) {
    const bytes = await readImageForPdf(src, w, h);
    return bytes ? pdf.embedJpg(bytes) : null;
  }

  // Page state ---------------------------------------------------------------
  let page: PDFPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage(): void {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }
  function ensure(height: number): void {
    if (y - height < BOTTOM) newPage();
  }
  function text(
    value: string,
    x: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
  ): void {
    page.drawText(safeText(value), { x, y: baseline, size, font, color });
  }
  function paragraph(
    value: string,
    x: number,
    width: number,
    size: number,
    font: PDFFont,
    color: RGB,
    leading = size * 1.45,
  ): void {
    for (const line of wrapText(value, font, size, width)) {
      ensure(leading);
      text(line, x, y - size, size, font, color);
      y -= leading;
    }
  }
  function sectionTitle(eyebrow: string, title: string): void {
    ensure(54);
    text(eyebrow.toUpperCase(), MARGIN, y - 8, 8, bold, TEAL);
    text(title, MARGIN, y - 30, 20, bold, INK);
    page.drawRectangle({ x: MARGIN, y: y - 40, width: 34, height: 3, color: GOLD });
    y -= 58;
  }

  // 1. Cover -------------------------------------------------------------------
  const coverHeight = 330;
  const heroSlug = stops[0]?.slug;
  const coverPhoto = await embedJpg(
    (heroSlug ? bySlug.get(heroSlug)?.heroImage : null) ??
      input.destinations.find((item) => item.heroImage)?.heroImage,
    1190,
    Math.round((coverHeight * 1190) / PAGE_WIDTH),
  );
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - coverHeight,
    width: PAGE_WIDTH,
    height: coverHeight,
    color: NAVY,
  });
  if (coverPhoto) {
    page.drawImage(coverPhoto, {
      x: 0,
      y: PAGE_HEIGHT - coverHeight,
      width: PAGE_WIDTH,
      height: coverHeight,
    });
  }
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - coverHeight,
    width: PAGE_WIDTH,
    height: coverHeight,
    color: NAVY,
    opacity: coverPhoto ? 0.58 : 0,
  });

  const logoBytes = await readLogoForPdf(120);
  let wordX = MARGIN;
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const logoH = 46;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawRectangle({
      x: MARGIN - 6,
      y: PAGE_HEIGHT - MARGIN - logoH - 6,
      width: logoW + 12,
      height: logoH + 12,
      color: WHITE,
      opacity: 0.94,
    });
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - logoH,
      width: logoW,
      height: logoH,
    });
    wordX = MARGIN + logoW + 20;
  }
  text("GO LANKA", wordX, PAGE_HEIGHT - MARGIN - 18, 16, bold, WHITE);
  text("PRIVATE TOURS ACROSS SRI LANKA", wordX, PAGE_HEIGHT - MARGIN - 33, 7, bold, GOLD);
  const refWidth = bold.widthOfTextAtSize(input.reference, 10);
  text(input.reference, PAGE_WIDTH - MARGIN - refWidth, PAGE_HEIGHT - MARGIN - 14, 10, bold, WHITE);
  const preparedOn = new Date().toISOString().slice(0, 10);
  const preparedWidth = regular.widthOfTextAtSize(`Prepared ${preparedOn}`, 8);
  text(
    `Prepared ${preparedOn}`,
    PAGE_WIDTH - MARGIN - preparedWidth,
    PAGE_HEIGHT - MARGIN - 28,
    8,
    regular,
    rgb(0.85, 0.9, 0.93),
  );

  let coverY = PAGE_HEIGHT - coverHeight + 108;
  text("YOUR SRI LANKA JOURNEY QUOTATION", MARGIN, coverY + 44, 9, bold, GOLD);
  for (const line of wrapText(input.itinerary.title, bold, 26, CONTENT_WIDTH).slice(0, 2)) {
    text(line, MARGIN, coverY + 14, 26, bold, WHITE);
    coverY -= 31;
  }
  const routeLine = stops.map((stop) => stop.name).join("  >  ");
  for (const line of wrapText(routeLine, regular, 10, CONTENT_WIDTH).slice(0, 2)) {
    text(line, MARGIN, coverY + 10, 10, regular, rgb(0.88, 0.93, 0.95));
    coverY -= 14;
  }

  y = PAGE_HEIGHT - coverHeight - 28;
  paragraph(input.itinerary.summary, MARGIN, CONTENT_WIDTH, 11, regular, INK, 16);
  y -= 14;

  // Key facts card grid.
  const facts: Array<[string, string]> = [
    ["Duration", `${input.quiz.days} days / ${input.quiz.nights} nights`],
    ["Travellers", `${travellerText}`],
    ["Travel month", MONTHS[input.quiz.travelMonth - 1] ?? ""],
    ["Total distance", `${distanceKm} km by road`],
    [
      "Hotels",
      `${BUDGET_LABELS[input.quiz.budget]}, ${BOARD_LABELS[input.quiz.board].toLowerCase()}`,
    ],
    ["Transport", input.breakdown.ride.vehicleName ?? "Arranged by the team"],
  ];
  const cardW = (CONTENT_WIDTH - 16) / 3;
  const cardH = 52;
  facts.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const cx = MARGIN + col * (cardW + 8);
    const cy = y - row * (cardH + 8) - cardH;
    page.drawRectangle({ x: cx, y: cy, width: cardW, height: cardH, color: TINT });
    text(label.toUpperCase(), cx + 10, cy + cardH - 17, 7, bold, TEAL);
    const valueLines = wrapText(value, bold, 10, cardW - 20).slice(0, 2);
    valueLines.forEach((line, i) => text(line, cx + 10, cy + cardH - 33 - i * 12, 10, bold, INK));
  });
  y -= 2 * (cardH + 8) + 6;

  // Budget highlight.
  const budgetH = 74;
  page.drawRectangle({
    x: MARGIN,
    y: y - budgetH,
    width: CONTENT_WIDTH,
    height: budgetH,
    color: BRAND,
  });
  page.drawRectangle({ x: MARGIN, y: y - budgetH, width: 5, height: budgetH, color: GOLD });
  text("ESTIMATED BUDGET FOR THE WHOLE TOUR", MARGIN + 22, y - 24, 8, bold, GOLD);
  text(formatLkr(input.totalLkr), MARGIN + 22, y - 54, 28, bold, WHITE);
  const perPerson =
    travellers > 0
      ? `About ${formatLkr(Math.round(input.totalLkr / travellers))} per traveller`
      : "";
  if (perPerson) {
    const w = regular.widthOfTextAtSize(perPerson, 10);
    text(perPerson, MARGIN + CONTENT_WIDTH - w - 18, y - 52, 10, regular, rgb(0.88, 0.93, 0.95));
  }
  y -= budgetH + 14;
  paragraph(
    "An estimate based on your choices. The Go Lanka team confirms availability and the final price before anything is booked.",
    MARGIN,
    CONTENT_WIDTH,
    8.5,
    fonts.oblique,
    MUTED,
  );

  // 2. Route map -----------------------------------------------------------------
  newPage();
  sectionTitle("Your route", "The road we will travel");

  const mapScale = 0.5; // map viewBox is 600 x 900
  const mapW = 600 * mapScale;
  const mapH = 900 * mapScale;
  const mapX = MARGIN;
  const mapTop = y;
  if (mapTop - mapH < BOTTOM) newPage();
  const top = y;
  page.drawRectangle({
    x: mapX - 6,
    y: top - mapH - 6,
    width: mapW + 12,
    height: mapH + 12,
    color: rgb(0.96, 0.98, 0.99),
    borderColor: LINE,
    borderWidth: 1,
  });
  for (const region of sriLankaMapRegions) {
    page.drawSvgPath(region.path, {
      x: mapX,
      y: top,
      scale: mapScale,
      color: rgb(0.86, 0.93, 0.95),
      borderColor: rgb(0.62, 0.77, 0.82),
      borderWidth: 0.4,
    });
  }
  const located = stops
    .map((stop, index) => ({ stop, index }))
    .filter(
      (item): item is { stop: RouteStop & { lat: number; lng: number }; index: number } =>
        item.stop.lat !== null && item.stop.lng !== null,
    )
    .map(({ stop, index }) => {
      const point = projectSriLankaPoint(stop.lat, stop.lng);
      return { stop, index, px: mapX + point.x * mapScale, py: top - point.y * mapScale };
    });
  for (let i = 1; i < located.length; i += 1) {
    const a = located[i - 1]!;
    const b = located[i]!;
    page.drawLine({
      start: { x: a.px, y: a.py },
      end: { x: b.px, y: b.py },
      thickness: 2.2,
      color: GOLD,
      dashArray: [5, 4],
    });
  }
  const drawn = new Set<string>();
  const taken: Array<{ x: number; y: number; w: number }> = [];
  for (const item of located) {
    if (drawn.has(item.stop.slug)) continue;
    drawn.add(item.stop.slug);
    page.drawCircle({
      x: item.px,
      y: item.py,
      size: 8.5,
      color: BRAND,
      borderColor: WHITE,
      borderWidth: 1.6,
    });
    const label = String(item.index + 1);
    const lw = bold.widthOfTextAtSize(label, 8);
    text(label, item.px - lw / 2, item.py - 2.8, 8, bold, WHITE);
    const name = safeText(item.stop.name);
    const nw = bold.widthOfTextAtSize(name, 8);
    // Put the name where it does not run into another marker or label (right, left, below, above).
    const options = [
      { x: item.px + 13, y: item.py - 2.8 },
      { x: item.px - 13 - nw, y: item.py - 2.8 },
      { x: item.px - nw / 2, y: item.py - 19 },
      { x: item.px - nw / 2, y: item.py + 13 },
    ];
    const hits = (a: { x: number; y: number; w: number }, b: { x: number; y: number; w: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && Math.abs(a.y - b.y) < 12;
    const free = (o: { x: number; y: number }) => {
      const box = { x: o.x, y: o.y, w: nw };
      return (
        !taken.some((t) => hits(box, t)) &&
        !located.some((other) => hits(box, { x: other.px - 10, y: other.py - 2.8, w: 20 }))
      );
    };
    const chosen = options.find(free) ?? options[0]!;
    taken.push({ x: chosen.x, y: chosen.y, w: nw });
    text(name, chosen.x, chosen.y, 8, bold, INK);
  }
  text("Schematic map - not to scale", mapX, top - mapH - 20, 7, fonts.oblique, MUTED);

  // Stop list beside the map.
  const listX = mapX + mapW + 34;
  const listW = PAGE_WIDTH - MARGIN - listX;
  let ly = top - 4;
  text("TOTAL DISTANCE", listX, ly - 8, 8, bold, TEAL);
  text(`${distanceKm} km`, listX, ly - 32, 24, bold, INK);
  text(
    `${stops.length} stop${stops.length === 1 ? "" : "s"} over ${input.quiz.days} days`,
    listX,
    ly - 46,
    9,
    regular,
    MUTED,
  );
  ly -= 70;
  for (const [index, stop] of stops.entries()) {
    if (ly < top - mapH + 20) break;
    page.drawCircle({ x: listX + 9, y: ly - 9, size: 9, color: BRAND });
    const label = String(index + 1);
    text(label, listX + 9 - bold.widthOfTextAtSize(label, 8) / 2, ly - 11.8, 8, bold, WHITE);
    text(stop.name, listX + 26, ly - 8, 11, bold, INK);
    const detail =
      (index === 0 ? "Start" : `${Math.round(stop.legKm)} km from ${stops[index - 1]!.name}`) +
      `  |  ${stop.nights} night${stop.nights === 1 ? "" : "s"}`;
    const detailLines = wrapText(detail, regular, 8.5, listW - 26);
    detailLines.forEach((line, i) => text(line, listX + 26, ly - 21 - i * 11, 8.5, regular, MUTED));
    ly -= 30 + detailLines.length * 11 - 11;
    if (index < stops.length - 1) {
      page.drawLine({
        start: { x: listX + 9, y: ly + 4 },
        end: { x: listX + 9, y: ly - 4 },
        thickness: 1,
        color: LINE,
      });
    }
    ly -= 6;
  }
  y = top - mapH - 36;

  // 3. Places ------------------------------------------------------------------------
  const photoH = 125;
  const seen = new Set<string>();
  const places = stops.filter((stop) => {
    if (seen.has(stop.slug)) return false;
    seen.add(stop.slug);
    return true;
  });
  if (y - 330 < BOTTOM) newPage();
  sectionTitle("Where you will go", "The places on your journey");
  for (const stop of places) {
    const place = bySlug.get(stop.slug);
    if (!place) continue;
    const photo: PDFImage | null = await embedJpg(
      place.heroImage,
      Math.round(CONTENT_WIDTH * 2.4),
      Math.round(photoH * 2.4),
    );
    const descLines = wrapText(place.description, regular, 10, CONTENT_WIDTH);
    const highlights = place.highlights.slice(0, 5);
    const blockH =
      (photo ? photoH + 12 : 0) + 26 + descLines.length * 14 + (highlights.length ? 26 : 0) + 24;
    ensure(blockH);
    if (photo) {
      page.drawImage(photo, { x: MARGIN, y: y - photoH, width: CONTENT_WIDTH, height: photoH });
      page.drawRectangle({
        x: MARGIN,
        y: y - photoH,
        width: CONTENT_WIDTH,
        height: 4,
        color: GOLD,
      });
      y -= photoH + 12;
    }
    text(place.name, MARGIN, y - 14, 15, bold, INK);
    const tag = [place.region, place.bestSeason ? `Best: ${place.bestSeason}` : ""]
      .filter(Boolean)
      .join("  |  ");
    const tagW = regular.widthOfTextAtSize(safeText(tag), 8.5);
    text(tag, PAGE_WIDTH - MARGIN - tagW, y - 13, 8.5, regular, TEAL);
    y -= 24;
    paragraph(place.description, MARGIN, CONTENT_WIDTH, 10, regular, INK, 14);
    if (highlights.length) {
      y -= 4;
      let hx = MARGIN;
      ensure(22);
      for (const item of highlights) {
        const label = safeText(item);
        const w = regular.widthOfTextAtSize(label, 8.5) + 16;
        if (hx + w > MARGIN + CONTENT_WIDTH) {
          hx = MARGIN;
          y -= 22;
          ensure(22);
        }
        page.drawRectangle({ x: hx, y: y - 16, width: w, height: 16, color: TINT });
        text(label, hx + 8, y - 11.5, 8.5, regular, BRAND);
        hx += w + 6;
      }
      y -= 22;
    }
    y -= 20;
  }

  // 4. Day by day -----------------------------------------------------------------------
  newPage();
  sectionTitle("Day by day", "Your itinerary");
  for (const day of input.itinerary.days) {
    const placeName = bySlug.get(day.destination_slug)?.name ?? day.destination_slug;
    const noteLines = wrapText(day.notes, regular, 9.5, CONTENT_WIDTH - 70);
    const activityText = day.activities.length ? `Activities: ${day.activities.join(", ")}` : "";
    const activityLines = activityText
      ? wrapText(activityText, regular, 9, CONTENT_WIDTH - 70)
      : [];
    const blockH = 24 + noteLines.length * 13 + activityLines.length * 12 + 30;
    ensure(blockH);
    page.drawRectangle({
      x: MARGIN,
      y: y - blockH + 8,
      width: 52,
      height: blockH - 8,
      color: TINT,
    });
    text("DAY", MARGIN + 12, y - 18, 7, bold, TEAL);
    const dayLabel = String(day.day);
    text(dayLabel, MARGIN + 26 - bold.widthOfTextAtSize(dayLabel, 20) / 2, y - 40, 20, bold, BRAND);
    const bx = MARGIN + 66;
    text(day.title, bx, y - 12, 11, bold, INK);
    const meta =
      placeName + (day.travel_km > 0 ? `  |  Drive ${Math.round(day.travel_km)} km` : "");
    text(meta, bx, y - 25, 8.5, bold, TEAL);
    let dy = y - 38;
    for (const line of noteLines) {
      text(line, bx, dy, 9.5, regular, INK);
      dy -= 13;
    }
    for (const line of activityLines) {
      text(line, bx, dy, 9, regular, MUTED);
      dy -= 12;
    }
    text(`Overnight: ${day.overnight}`, bx, dy - 2, 9, bold, INK);
    y -= blockH + 4;
  }

  // 5. Budget -------------------------------------------------------------------------------
  ensure(330);
  y -= 6;
  sectionTitle("Estimated budget", "What the tour is expected to cost");
  const breakdown = input.breakdown;
  const rows: Array<[string, string, number]> = breakdown.stay
    ? [
        ["Hotels", describeStay(breakdown), breakdown.stay.subtotalLkr],
        ["Transport", describeRide(breakdown), breakdown.ride.subtotalLkr],
      ]
    : [];
  for (const [label, detail, amount] of rows) {
    const detailLines = wrapText(detail, regular, 9, CONTENT_WIDTH - 190);
    const rowH = Math.max(34, 18 + detailLines.length * 12);
    ensure(rowH + 6);
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_WIDTH, height: rowH, color: TINT });
    text(label, MARGIN + 12, y - 20, 11, bold, INK);
    detailLines.forEach((line, i) => text(line, MARGIN + 92, y - 17 - i * 12, 9, regular, MUTED));
    const amountText = formatLkr(amount);
    text(
      amountText,
      MARGIN + CONTENT_WIDTH - 12 - bold.widthOfTextAtSize(safeText(amountText), 11),
      y - 20,
      11,
      bold,
      INK,
    );
    y -= rowH + 6;
  }
  ensure(60);
  page.drawRectangle({ x: MARGIN, y: y - 44, width: CONTENT_WIDTH, height: 44, color: NAVY });
  text("ESTIMATED TOTAL", MARGIN + 14, y - 27, 9, bold, GOLD);
  const totalText = formatLkr(input.totalLkr);
  text(
    totalText,
    MARGIN + CONTENT_WIDTH - 14 - bold.widthOfTextAtSize(safeText(totalText), 18),
    y - 30,
    18,
    bold,
    WHITE,
  );
  y -= 58;

  if (breakdown.notes.length) {
    for (const note of breakdown.notes) {
      paragraph(`- ${note}`, MARGIN, CONTENT_WIDTH, 8.5, regular, MUTED);
    }
    y -= 4;
  }
  if (input.adminNotes) {
    y -= 4;
    ensure(30);
    text("NOTE FROM THE TEAM", MARGIN, y - 8, 8, bold, TEAL);
    y -= 16;
    paragraph(input.adminNotes, MARGIN, CONTENT_WIDTH, 9.5, regular, INK);
    y -= 4;
  }
  y -= 6;
  paragraph(
    "Prices are in Sri Lankan rupees (LKR) and cover hotels and transport as described above. Entrance fees, flights and personal spending are not included unless stated. This itinerary was drafted with AI and is an estimate: the Go Lanka team confirms destinations, hotels and availability before booking.",
    MARGIN,
    CONTENT_WIDTH,
    8.5,
    fonts.oblique,
    MUTED,
  );
  if (input.packageTitle) {
    paragraph(`Route reference: ${input.packageTitle}`, MARGIN, CONTENT_WIDTH, 8.5, regular, MUTED);
  }

  // Footer on every page except the cover ------------------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    if (index === 0) return;
    pdfPage.drawLine({
      start: { x: MARGIN, y: 38 },
      end: { x: PAGE_WIDTH - MARGIN, y: 38 },
      thickness: 0.6,
      color: LINE,
    });
    pdfPage.drawText(safeText(`Go Lanka  |  ${input.reference}`), {
      x: MARGIN,
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    pdfPage.drawText(label, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: 24,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  return Buffer.from(await pdf.save());
}
