import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
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

// ---------------------------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------------------------
const W = 595.28;
const H = 841.89;
const MARGIN = 48;
const CW = W - MARGIN * 2;
const TOP = H - 74; // first content line on inner pages (below the running header)
const BOTTOM = 62; // lowest content line (above the footer)

const hex = (value: string): RGB => {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const NAVY = hex("#0a2a3f");
const BRAND = hex("#1b5e83");
const TEAL = hex("#0f7f88");
const GOLD = hex("#f2b01e");
const INK = hex("#10242f");
const MUTED = hex("#5d7079");
const LINE = hex("#dce5e9");
const TINT = hex("#f1f6f8");
const SEA = hex("#d6e9f1");
const LAND = hex("#fbf8ef");
const WHITE = hex("#ffffff");

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

type Fonts = {
  head: PDFFont; // Montserrat 700
  headSemi: PDFFont; // Montserrat 600
  body: PDFFont; // Open Sans 400
  bodySemi: PDFFont; // Open Sans 600
  bodyBold: PDFFont; // Open Sans 700
  italic: PDFFont; // Open Sans 400 italic
};

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "fonts", "pdf");
  try {
    pdf.registerFontkit(fontkit);
    const embed = async (file: string) =>
      pdf.embedFont(await readFile(path.join(dir, file)), { subset: true });
    return {
      head: await embed("montserrat-latin-700-normal.woff"),
      headSemi: await embed("montserrat-latin-600-normal.woff"),
      body: await embed("open-sans-latin-400-normal.woff"),
      bodySemi: await embed("open-sans-latin-600-normal.woff"),
      bodyBold: await embed("open-sans-latin-700-normal.woff"),
      italic: await embed("open-sans-latin-400-italic.woff"),
    };
  } catch {
    // A missing font file must never block a quotation: fall back to the built-in fonts.
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    return {
      head: bold,
      headSemi: bold,
      body: regular,
      bodySemi: bold,
      bodyBold: bold,
      italic,
    };
  }
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

// ---------------------------------------------------------------------------------------------
// Route data
// ---------------------------------------------------------------------------------------------

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
  firstDay: number;
  lastDay: number;
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
      last.lastDay = day.day;
      continue;
    }
    const place = bySlug.get(day.destination_slug);
    const fallback = findMainPlace(day.destination_slug);
    stops.push({
      slug: day.destination_slug,
      name: place?.name ?? fallback?.name ?? day.destination_slug,
      region: place?.region ?? fallback?.region ?? "",
      lat: place?.lat ?? fallback?.lat ?? null,
      lng: place?.lng ?? fallback?.lng ?? null,
      legKm: stops.length === 0 ? 0 : day.travel_km,
      nights: 1,
      firstDay: day.day,
      lastDay: day.day,
    });
  }
  return stops;
}

const dayRange = (stop: RouteStop) =>
  stop.firstDay === stop.lastDay ? `Day ${stop.firstDay}` : `Days ${stop.firstDay}-${stop.lastDay}`;

// ---------------------------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------------------------
export async function generateItineraryPdf(input: {
  quiz: PdfQuiz;
  itinerary: GeneratedItinerary;
  breakdown: QuoteBreakdown;
  totalLkr: number;
  reference: string;
  packageTitle?: string | null;
  destinations: TourBuilderDestination[];
  adminNotes?: string | null;
  /** The team's WhatsApp number, shown under "next steps". */
  whatsapp?: string | null;
}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Go Lanka quotation ${input.reference}`);
  pdf.setAuthor("Go Lanka");
  pdf.setSubject(input.itinerary.title);
  pdf.setCreator("Go Lanka");
  const f = await loadFonts(pdf);

  const stops = buildRouteStops(input.itinerary, input.destinations);
  const bySlug = new Map(input.destinations.map((item) => [item.slug, item]));
  const distanceKm = Math.round(input.itinerary.days.reduce((sum, d) => sum + d.travel_km, 0));
  const travellers = input.quiz.adults + input.quiz.children;
  const travellerText =
    `${input.quiz.adults} adult${input.quiz.adults === 1 ? "" : "s"}` +
    (input.quiz.children > 0
      ? `, ${input.quiz.children} child${input.quiz.children === 1 ? "" : "ren"}`
      : "");
  const preparedOn = new Date().toISOString().slice(0, 10);

  async function embedJpg(
    src: string | null | undefined,
    w: number,
    h: number,
    shade?: Parameters<typeof readImageForPdf>[3],
  ) {
    const bytes = await readImageForPdf(src, w, h, shade);
    return bytes ? pdf.embedJpg(bytes) : null;
  }

  // -- Drawing helpers ----------------------------------------------------------------------
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H;

  const topY = (pdfY: number) => H - pdfY; // PDF y -> SVG-style y from the top of the page

  /** Rounded rectangle (PDF coordinates, bottom-left origin). */
  function rr(
    x: number,
    by: number,
    w: number,
    h: number,
    r: number,
    opts: { color?: RGB; border?: RGB; borderWidth?: number; opacity?: number },
  ) {
    const t = topY(by + h);
    const d =
      `M${x + r},${t} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${t + r} V${t + h - r} ` +
      `A${r},${r} 0 0 1 ${x + w - r},${t + h} H${x + r} A${r},${r} 0 0 1 ${x},${t + h - r} ` +
      `V${t + r} A${r},${r} 0 0 1 ${x + r},${t} Z`;
    page.drawSvgPath(d, {
      x: 0,
      y: H,
      color: opts.color,
      borderColor: opts.border,
      borderWidth: opts.border ? (opts.borderWidth ?? 0.8) : undefined,
      opacity: opts.opacity,
    });
  }
  function poly(points: Array<[number, number]>, color: RGB, opacity = 1) {
    const d =
      points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${topY(py)}`).join(" ") + " Z";
    page.drawSvgPath(d, { x: 0, y: H, color, opacity });
  }
  function circle(
    cx: number,
    cy: number,
    r: number,
    color: RGB,
    opacity = 1,
    border?: RGB,
    bw = 1,
  ) {
    page.drawCircle({
      x: cx,
      y: cy,
      size: r,
      color,
      opacity,
      borderColor: border,
      borderWidth: border ? bw : undefined,
    });
  }
  function text(
    value: string,
    x: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
  ) {
    page.drawText(safeText(value), { x, y: baseline, size, font, color });
  }
  const tw = (value: string, font: PDFFont, size: number) =>
    font.widthOfTextAtSize(safeText(value), size);
  function textRight(
    value: string,
    right: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
  ) {
    text(value, right - tw(value, font, size), baseline, size, font, color);
  }
  function textCenter(
    value: string,
    cx: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
  ) {
    text(value, cx - tw(value, font, size) / 2, baseline, size, font, color);
  }
  /** Small upper-case label with letter-spacing. */
  function spaced(
    value: string,
    x: number,
    baseline: number,
    size: number,
    font: PDFFont,
    color: RGB,
    track = 1.4,
  ) {
    let cursor = x;
    for (const ch of safeText(value.toUpperCase())) {
      page.drawText(ch, { x: cursor, y: baseline, size, font, color });
      cursor += font.widthOfTextAtSize(ch, size) + track;
    }
  }
  const spacedWidth = (value: string, size: number, font: PDFFont, track = 1.4) =>
    [...safeText(value.toUpperCase())].reduce(
      (sum, ch) => sum + font.widthOfTextAtSize(ch, size) + track,
      0,
    ) - track;
  function clipTo(x: number, by: number, w: number, h: number, draw: () => void) {
    page.pushOperators(pushGraphicsState(), rectangle(x, by, w, h), clip(), endPath());
    draw();
    page.pushOperators(popGraphicsState());
  }

  // -- Flow helpers --------------------------------------------------------------------------
  function newPage(): void {
    page = pdf.addPage([W, H]);
    y = TOP;
  }
  function ensure(height: number): void {
    if (y - height < BOTTOM) newPage();
  }
  function paragraph(
    value: string,
    x: number,
    width: number,
    size: number,
    font: PDFFont,
    color: RGB,
    leading = size * 1.5,
  ): void {
    for (const line of wrapText(value, font, size, width)) {
      ensure(leading);
      text(line, x, y - size, size, font, color);
      y -= leading;
    }
  }
  function sectionHeader(no: string, eyebrow: string, title: string, lead?: string): void {
    ensure(lead ? 110 : 62);
    spaced(`${no}  |  ${eyebrow}`, MARGIN, y - 8, 7.5, f.bodyBold, TEAL, 1.6);
    text(title, MARGIN, y - 34, 22, f.head, NAVY);
    page.drawRectangle({ x: MARGIN, y: y - 46, width: 36, height: 3, color: GOLD });
    y -= 62;
    if (lead) {
      paragraph(lead, MARGIN, CW, 11, f.body, MUTED, 17);
      y -= 8;
    }
  }

  // ===========================================================================================
  // 1. COVER
  // ===========================================================================================
  const photoBlock = 500;
  const heroSlug = stops[0]?.slug;
  const coverPhoto = await embedJpg(
    (heroSlug ? bySlug.get(heroSlug)?.heroImage : null) ??
      input.destinations.find((item) => item.heroImage)?.heroImage,
    Math.round(W * 2.2),
    Math.round(photoBlock * 2.2),
    { flat: 0.16, bottom: 0.94, bottomFraction: 0.55, top: 0.6, topFraction: 0.26 },
  );
  page.drawRectangle({ x: 0, y: H - photoBlock, width: W, height: photoBlock, color: NAVY });
  if (coverPhoto) {
    page.drawImage(coverPhoto, { x: 0, y: H - photoBlock, width: W, height: photoBlock });
  }
  // Logo card + wordmark.
  const logoBytes = await readLogoForPdf(140);
  const logoH = 44;
  let logoW = 0;
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    logoW = (logo.width / logo.height) * logoH;
    rr(MARGIN - 8, H - 40 - logoH - 8, logoW + 16, logoH + 16, 12, { color: WHITE });
    page.drawImage(logo, { x: MARGIN, y: H - 40 - logoH, width: logoW, height: logoH });
  }
  const wordX = MARGIN + (logoW ? logoW + 20 : 0);
  text("Go Lanka", wordX, H - 40 - 20, 18, f.head, WHITE);
  spaced("Private tours across Sri Lanka", wordX, H - 40 - 35, 6.5, f.bodyBold, GOLD, 1.3);

  // Quotation tag, top right.
  const tag = "TRAVEL QUOTATION";
  const tagW = spacedWidth(tag, 7.5, f.bodyBold, 1.6) + 28;
  rr(W - MARGIN - tagW, H - 40 - 22, tagW, 22, 11, { color: GOLD });
  spaced(tag, W - MARGIN - tagW + 14, H - 40 - 15, 7.5, f.bodyBold, NAVY, 1.6);
  textRight(input.reference, W - MARGIN, H - 40 - 42, 9, f.bodySemi, WHITE);

  // Title block.
  const titleLines = wrapText(input.itinerary.title, f.head, 30, CW - 20).slice(0, 3);
  let ty = H - photoBlock + 56 + titleLines.length * 36;
  spaced("Your private Sri Lanka journey", MARGIN, ty + 10, 8, f.bodyBold, GOLD, 1.8);
  for (const line of titleLines) {
    text(line, MARGIN, ty - 24, 30, f.head, WHITE);
    ty -= 36;
  }
  const routeText = stops.map((stop) => stop.name).join("   /   ");
  const routeLines = wrapText(routeText, f.bodySemi, 10, CW).slice(0, 2);
  routeLines.forEach((line, i) =>
    text(line, MARGIN, H - photoBlock + 40 - i * 15, 10, f.bodySemi, hex("#dbe9ef")),
  );

  // Facts strip.
  const stripY = H - photoBlock - 96;
  const facts: Array<[string, string, string]> = [
    ["Duration", `${input.quiz.days} days`, `${input.quiz.nights} nights`],
    ["Travellers", String(travellers), travellerText],
    [
      "Distance",
      `${distanceKm} km`,
      `${stops.length} stop${stops.length === 1 ? "" : "s"} by road`,
    ],
    [
      "Travelling in",
      MONTHS[input.quiz.travelMonth - 1] ?? "",
      input.breakdown.ride.vehicleName ?? "",
    ],
  ];
  const colW = CW / facts.length;
  facts.forEach(([label, big, small], i) => {
    const x = MARGIN + i * colW;
    if (i > 0)
      page.drawLine({
        start: { x, y: stripY + 6 },
        end: { x, y: stripY + 62 },
        thickness: 0.7,
        color: LINE,
      });
    const padX = i === 0 ? 0 : 18;
    spaced(label, x + padX, stripY + 54, 6.8, f.bodyBold, TEAL, 1.4);
    text(big, x + padX, stripY + 28, 19, f.head, NAVY);
    text(
      wrapText(small, f.body, 8.5, colW - padX - 6)[0] ?? "",
      x + padX,
      stripY + 10,
      8.5,
      f.body,
      MUTED,
    );
  });

  // Budget panel.
  const panelH = 108;
  const panelY = stripY - 28 - panelH;
  rr(MARGIN, panelY, CW, panelH, 14, { color: NAVY });
  page.drawRectangle({ x: MARGIN, y: panelY + 14, width: 5, height: panelH - 28, color: GOLD });
  spaced(
    "Estimated budget for the whole tour",
    MARGIN + 28,
    panelY + panelH - 30,
    7.5,
    f.bodyBold,
    GOLD,
    1.6,
  );
  text(formatLkr(input.totalLkr), MARGIN + 28, panelY + 36, 34, f.head, WHITE);
  const inclTx = `${BUDGET_LABELS[input.quiz.budget]} hotels, ${BOARD_LABELS[input.quiz.board].toLowerCase()}, and transport.`;
  const rightX = MARGIN + CW - 26;
  if (travellers > 0) {
    textRight(
      `${formatLkr(Math.round(input.totalLkr / travellers))}`,
      rightX,
      panelY + 56,
      16,
      f.head,
      WHITE,
    );
    textRight("per traveller", rightX, panelY + 40, 8.5, f.body, hex("#b9d2de"));
  }
  text(inclTx, MARGIN + 28, panelY + 14, 8.5, f.body, hex("#b9d2de"));

  y = panelY - 22;
  paragraph(
    "This is an estimate prepared from your choices. Our team confirms availability and your final price before anything is booked.",
    MARGIN,
    CW,
    8.5,
    f.italic,
    MUTED,
    13,
  );
  text(`Prepared on ${preparedOn}`, MARGIN, 40, 8, f.body, MUTED);

  // ===========================================================================================
  // 2. JOURNEY: MAP + ROUTE TABLE
  // ===========================================================================================
  newPage();
  sectionHeader("01", "Your journey", "The route at a glance", input.itinerary.summary);

  const frameW = CW;
  const frameH = 440;
  if (y - frameH < BOTTOM) newPage();
  const frameX = MARGIN;
  const frameB = y - frameH;

  type Placed = { stop: RouteStop; index: number; vx: number; vy: number };
  const located: Placed[] = [];
  stops.forEach((stop, index) => {
    if (stop.lat === null || stop.lng === null) return;
    const point = projectSriLankaPoint(stop.lat, stop.lng);
    located.push({ stop, index, vx: point.x, vy: point.y });
  });

  // View window in map units: the route's bounding box plus room for the labels.
  let minX = 40;
  let maxX = 560;
  let minY = 20;
  let maxY = 880;
  if (located.length > 0) {
    const xs = located.map((p) => p.vx);
    const ys = located.map((p) => p.vy);
    minX = Math.min(...xs) - 110;
    maxX = Math.max(...xs) + 120;
    minY = Math.min(...ys) - 50;
    maxY = Math.max(...ys) + 50;
  }
  const minW = 280;
  const minH = 200;
  if (maxX - minX < minW) {
    const mid = (minX + maxX) / 2;
    minX = mid - minW / 2;
    maxX = mid + minW / 2;
  }
  if (maxY - minY < minH) {
    const mid = (minY + maxY) / 2;
    minY = mid - minH / 2;
    maxY = mid + minH / 2;
  }
  const scale = Math.min(frameW / (maxX - minX), frameH / (maxY - minY));
  const offX = frameX + (frameW - (maxX - minX) * scale) / 2 - minX * scale;
  const offTop = frameB + frameH - (frameH - (maxY - minY) * scale) / 2 + minY * scale; // PDF y of map y=0
  const mx = (vx: number) => offX + vx * scale;
  const my = (vy: number) => offTop - vy * scale;

  rr(frameX, frameB, frameW, frameH, 14, { color: SEA });
  clipTo(frameX + 1, frameB + 1, frameW - 2, frameH - 2, () => {
    // Sea names.
    const sea = hex("#8fb6c8");
    for (const [label, vx, vy] of [
      ["Indian Ocean", 215, 845],
      ["Bay of Bengal", 505, 330],
      ["Laccadive Sea", 75, 470],
    ] as Array<[string, number, number]>) {
      const px = mx(vx);
      const py = my(vy);
      if (
        px > frameX + 10 &&
        px < frameX + frameW - 60 &&
        py > frameB + 10 &&
        py < frameB + frameH - 10
      ) {
        spaced(label, px - spacedWidth(label, 7, f.italic, 2) / 2, py, 7, f.italic, sea, 2);
      }
    }
    // Land.
    for (const region of sriLankaMapRegions) {
      page.drawSvgPath(region.path, {
        x: offX,
        y: offTop,
        scale,
        color: LAND,
        borderColor: hex("#c3d4da"),
        borderWidth: 0.45,
      });
    }
  });

  // Route: curved legs, arrows and distance chips.
  const taken: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const p of located) {
    taken.push({ x: mx(p.vx) - 14, y: my(p.vy) - 14, w: 28, h: 28 });
  }
  const legs: Array<{ from: Placed; to: Placed }> = [];
  for (let i = 1; i < located.length; i += 1) {
    legs.push({ from: located[i - 1]!, to: located[i]! });
  }
  const drawLegs = (pass: "casing" | "line" | "decor") => {
    for (const leg of legs) {
      const x0 = mx(leg.from.vx);
      const y0 = my(leg.from.vy);
      const x1 = mx(leg.to.vx);
      const y1 = my(leg.to.vy);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(26, len * 0.16);
      const cx = (x0 + x1) / 2 - (dy / len) * bend;
      const cy = (y0 + y1) / 2 + (dx / len) * bend;
      if (pass !== "decor") {
        const d = `M${x0},${topY(y0)} Q${cx},${topY(cy)} ${x1},${topY(y1)}`;
        page.drawSvgPath(d, {
          x: 0,
          y: H,
          borderColor: pass === "casing" ? WHITE : TEAL,
          borderWidth: pass === "casing" ? 6 : 2.6,
          borderLineCap: 1,
        });
      } else {
        // Direction arrow at 62% along the curve, then the distance chip at the middle.
        const t = 0.62;
        const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
        const tx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
        const ty2 = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
        const tl = Math.hypot(tx, ty2) || 1;
        const ux = tx / tl;
        const uy = ty2 / tl;
        if (len > 40) {
          poly(
            [
              [bx + ux * 6, by + uy * 6],
              [bx - ux * 4 - uy * 4.5, by - uy * 4 + ux * 4.5],
              [bx - ux * 4 + uy * 4.5, by - uy * 4 - ux * 4.5],
            ],
            TEAL,
          );
        }
        if (len > 52 && leg.to.stop.legKm > 0) {
          const label = `${Math.round(leg.to.stop.legKm)} km`;
          const w = tw(label, f.headSemi, 7) + 12;
          const mxp = 0.25 * x0 + 0.5 * cx + 0.25 * x1;
          const myp = 0.25 * y0 + 0.5 * cy + 0.25 * y1;
          const chip = { x: mxp - w / 2, y: myp - 7, w, h: 14 };
          rr(chip.x, chip.y, chip.w, chip.h, 7, { color: GOLD, border: WHITE, borderWidth: 1.2 });
          textCenter(label, mxp, myp - 2.4, 7, f.headSemi, NAVY);
          taken.push(chip);
        }
      }
    }
  };
  clipTo(frameX + 1, frameB + 1, frameW - 2, frameH - 2, () => {
    drawLegs("casing");
    drawLegs("line");
    drawLegs("decor");
  });

  // Pins with name labels (one pin per place; a return to the start shares the first pin).
  const pinned = new Set<string>();
  for (const p of located) {
    if (pinned.has(p.stop.slug)) continue;
    pinned.add(p.stop.slug);
    const px = mx(p.vx);
    const py = my(p.vy);
    circle(px, py, 16, BRAND, 0.16);
    circle(px + 0.8, py - 1.4, 11, hex("#000000"), 0.18);
    circle(px, py, 11, BRAND, 1, WHITE, 2.2);
    textCenter(String(p.index + 1), px, py - 3.2, 9, f.head, WHITE);

    const sameSlug = located.filter((q) => q.stop.slug === p.stop.slug);
    const sub = sameSlug.length > 1 ? "Start & finish" : dayRange(p.stop);
    const name = p.stop.name;
    const w = Math.max(tw(name, f.headSemi, 8.5), tw(sub, f.body, 6.8)) + 16;
    const h = 25;
    const options = [
      { x: px + 15, y: py - h / 2 },
      { x: px - 15 - w, y: py - h / 2 },
      { x: px + 12, y: py - 14 - h },
      { x: px - 12 - w, y: py - 14 - h },
      { x: px + 12, y: py + 14 },
      { x: px - 12 - w, y: py + 14 },
      { x: px - w / 2, y: py - 17 - h },
      { x: px - w / 2, y: py + 17 },
    ];
    const cost = (o: { x: number; y: number }) => {
      const box = { x: o.x, y: o.y, w, h };
      let c = 0;
      for (const t of taken) {
        const ox = Math.min(box.x + w, t.x + t.w) - Math.max(box.x, t.x);
        const oy = Math.min(box.y + h, t.y + t.h) - Math.max(box.y, t.y);
        if (ox > 0 && oy > 0) c += ox * oy;
      }
      const out =
        Math.max(0, frameX + 6 - box.x) +
        Math.max(0, box.x + w - (frameX + frameW - 6)) +
        Math.max(0, frameB + 6 - box.y) +
        Math.max(0, box.y + h - (frameB + frameH - 6));
      return c + out * 400;
    };
    const chosen = options.reduce((best, o) => (cost(o) < cost(best) ? o : best), options[0]!);
    taken.push({ x: chosen.x, y: chosen.y, w, h });
    rr(chosen.x + 0.6, chosen.y - 1, w, h, 6, { color: hex("#000000"), opacity: 0.1 });
    rr(chosen.x, chosen.y, w, h, 6, { color: WHITE });
    text(name, chosen.x + 8, chosen.y + h - 10, 8.5, f.headSemi, NAVY);
    text(sub, chosen.x + 8, chosen.y + 5.5, 6.8, f.body, MUTED);
  }

  // Compass, scale bar, caption.
  const cX = frameX + frameW - 30;
  const cY = frameB + frameH - 34;
  circle(cX, cY, 15, WHITE, 0.92, LINE, 0.7);
  poly(
    [
      [cX, cY + 11],
      [cX - 4.5, cY - 2],
      [cX + 4.5, cY - 2],
    ],
    NAVY,
  );
  poly(
    [
      [cX, cY - 10],
      [cX - 4.5, cY - 2],
      [cX + 4.5, cY - 2],
    ],
    hex("#b8c8cf"),
  );
  textCenter("N", cX, cY + 15.5, 6.5, f.head, NAVY);
  const unitsPerKm = 220.18 / 111.19;
  const barKm = scale * unitsPerKm * 50 > 150 ? 100 : 50;
  const barLen = barKm * unitsPerKm * scale;
  const barX = frameX + 18;
  const barY = frameB + 18;
  rr(barX - 8, barY - 8, barLen + 52, 24, 6, { color: WHITE, opacity: 0.9 });
  page.drawRectangle({ x: barX, y: barY, width: barLen / 2, height: 3.4, color: NAVY });
  page.drawRectangle({
    x: barX + barLen / 2,
    y: barY,
    width: barLen / 2,
    height: 3.4,
    color: hex("#8aa3b0"),
  });
  text(`${barKm} km`, barX + barLen + 6, barY - 1.4, 7, f.bodySemi, MUTED);
  rr(frameX, frameB, frameW, frameH, 14, { border: LINE, borderWidth: 1 });
  y = frameB - 8;
  text(
    "Schematic map, not to scale. Distances are approximate road distances.",
    MARGIN,
    y - 8,
    7.2,
    f.italic,
    MUTED,
  );
  y -= 30;

  // Route table (kept together: starts on a new page unless most of it fits).
  ensure(24 + 30 * Math.min(stops.length, 6) + 34);
  const cols = {
    no: MARGIN + 14,
    stop: MARGIN + 44,
    days: MARGIN + 270,
    nights: MARGIN + 350,
    km: MARGIN + CW - 14,
  };
  const headRow = () => {
    rr(MARGIN, y - 24, CW, 24, 6, { color: NAVY });
    spaced("Stop", cols.stop, y - 15.5, 6.8, f.bodyBold, WHITE, 1.3);
    spaced("When", cols.days, y - 15.5, 6.8, f.bodyBold, WHITE, 1.3);
    spaced("Nights", cols.nights, y - 15.5, 6.8, f.bodyBold, WHITE, 1.3);
    const lab = "From previous";
    page.drawText(" ", { x: 0, y: 0, size: 1, font: f.body });
    spaced(
      lab,
      cols.km - spacedWidth(lab, 6.8, f.bodyBold, 1.3),
      y - 15.5,
      6.8,
      f.bodyBold,
      WHITE,
      1.3,
    );
    y -= 24;
  };
  headRow();
  stops.forEach((stop, i) => {
    if (y - 30 < BOTTOM) {
      newPage();
      headRow();
    }
    if (i % 2 === 0)
      page.drawRectangle({ x: MARGIN, y: y - 30, width: CW, height: 30, color: TINT });
    circle(cols.no, y - 15, 9, BRAND);
    textCenter(String(i + 1), cols.no, y - 18, 8.5, f.head, WHITE);
    text(stop.name, cols.stop, y - 14, 10, f.bodyBold, INK);
    if (stop.region) text(stop.region, cols.stop, y - 25, 7.5, f.body, MUTED);
    text(dayRange(stop), cols.days, y - 18, 9, f.body, INK);
    text(String(stop.nights), cols.nights, y - 18, 9, f.body, INK);
    textRight(
      i === 0 ? "Start" : `${Math.round(stop.legKm)} km`,
      cols.km,
      y - 18,
      9,
      f.bodySemi,
      INK,
    );
    y -= 30;
  });
  ensure(34);
  rr(MARGIN, y - 30, CW, 30, 6, { color: hex("#e3eef3") });
  text("Total", cols.stop, y - 19, 10, f.head, NAVY);
  text(`${input.quiz.days} days`, cols.days, y - 19, 9, f.bodyBold, NAVY);
  text(`${input.quiz.nights}`, cols.nights, y - 19, 9, f.bodyBold, NAVY);
  textRight(`${distanceKm} km`, cols.km, y - 19, 10, f.head, NAVY);
  y -= 30;

  // ===========================================================================================
  // 3. DESTINATIONS
  // ===========================================================================================
  const seen = new Set<string>();
  const places = stops.filter((stop) => {
    if (seen.has(stop.slug)) return false;
    seen.add(stop.slug);
    return true;
  });
  if (y - 470 < BOTTOM) newPage();
  else y -= 14;
  sectionHeader(
    "02",
    "Where you will go",
    "The places on your journey",
    "A closer look at each stop: what makes it special and when it is at its best.",
  );
  const photoH = 168;
  for (const stop of places) {
    const place = bySlug.get(stop.slug);
    const fallback = findMainPlace(stop.slug);
    const description = place?.description || fallback?.blurb || "";
    const highlights = (place?.highlights ?? []).slice(0, 5);
    const photo: PDFImage | null = await embedJpg(
      place?.heroImage ?? fallback?.image.src,
      Math.round(CW * 2.4),
      Math.round(photoH * 2.4),
      { bottom: 0.9, bottomFraction: 0.55 },
    );
    const textW = CW - 196;
    const descLines = wrapText(description, f.body, 9.8, textW);
    const panelRows = 1 + highlights.length;
    const bodyH = Math.max(descLines.length * 15 + 6, 34 + panelRows * 16 + 18);
    const cardH = photoH + 16 + bodyH;
    ensure(cardH);
    const top = y;
    if (photo) {
      page.drawImage(photo, { x: MARGIN, y: top - photoH, width: CW, height: photoH });
    } else {
      page.drawRectangle({ x: MARGIN, y: top - photoH, width: CW, height: photoH, color: BRAND });
    }
    const index = stops.findIndex((s) => s.slug === stop.slug) + 1;
    circle(MARGIN + 28, top - photoH + 30, 14, GOLD);
    textCenter(String(index), MARGIN + 28, top - photoH + 26, 11.5, f.head, NAVY);
    text(stop.name, MARGIN + 52, top - photoH + 25, 19, f.head, WHITE);
    spaced(stop.region || " ", MARGIN + 52, top - photoH + 11, 6.8, f.bodyBold, GOLD, 1.5);
    const stay = `${dayRange(stop)}  |  ${stop.nights} night${stop.nights === 1 ? "" : "s"}`;
    textRight(stay, MARGIN + CW - 16, top - photoH + 14, 8.5, f.bodySemi, WHITE);

    let dy = top - photoH - 16;
    for (const line of descLines) {
      text(line, MARGIN, dy - 9.8, 9.8, f.body, INK);
      dy -= 15;
    }
    // Highlights panel.
    const px = MARGIN + textW + 18;
    const pw = CW - textW - 18;
    const ph = bodyH;
    rr(px, top - photoH - 10 - ph, pw, ph, 10, { color: TINT });
    spaced("Highlights", px + 14, top - photoH - 28, 6.8, f.bodyBold, TEAL, 1.4);
    let hy = top - photoH - 46;
    for (const item of highlights) {
      page.drawLine({
        start: { x: px + 14, y: hy + 3 },
        end: { x: px + 17.5, y: hy - 0.5 },
        thickness: 1.3,
        color: TEAL,
      });
      page.drawLine({
        start: { x: px + 17.5, y: hy - 0.5 },
        end: { x: px + 23, y: hy + 7 },
        thickness: 1.3,
        color: TEAL,
      });
      text(wrapText(item, f.body, 8.8, pw - 44)[0] ?? "", px + 30, hy, 8.8, f.body, INK);
      hy -= 16;
    }
    if (place?.bestSeason) {
      spaced("Best time", px + 14, hy - 8, 6.4, f.bodyBold, TEAL, 1.3);
      text(place.bestSeason, px + 14, hy - 21, 8.8, f.bodySemi, INK);
    }
    y = top - cardH - 20;
  }

  // ===========================================================================================
  // 4. DAY BY DAY
  // ===========================================================================================
  y -= 10;
  sectionHeader(
    "03",
    "Day by day",
    "Your itinerary",
    `${input.quiz.days} days, ${input.quiz.nights} nights, ${distanceKm} km by road. Timings stay flexible: your driver adapts to the pace you like.`,
  );
  const railX = MARGIN + 13;
  const cardX = MARGIN + 40;
  const cardW = CW - 40;
  for (const [index, day] of input.itinerary.days.entries()) {
    const placeName =
      bySlug.get(day.destination_slug)?.name ??
      findMainPlace(day.destination_slug)?.name ??
      day.destination_slug;
    const noteLines = wrapText(day.notes, f.body, 9.3, cardW - 28);
    const activities = day.activities.slice(0, 6);
    let chipRows = 0;
    {
      let cursor = 0;
      for (const a of activities) {
        const w = tw(a, f.body, 7.8) + 14;
        if (cursor + w > cardW - 28) {
          chipRows += 1;
          cursor = 0;
        }
        if (cursor === 0 && chipRows === 0) chipRows = 1;
        cursor += w + 5;
      }
    }
    const cardH = 52 + noteLines.length * 14 + chipRows * 22 + 26;
    ensure(cardH + 12);
    const top = y;
    // Timeline rail.
    if (index < input.itinerary.days.length - 1) {
      page.drawLine({
        start: { x: railX, y: top - 30 },
        end: { x: railX, y: top - cardH - 12 + 14 },
        thickness: 1.2,
        color: LINE,
      });
    }
    circle(railX, top - 16, 12.5, BRAND, 1, WHITE, 2);
    textCenter(String(day.day), railX, top - 20.2, 10.5, f.head, WHITE);
    rr(cardX, top - cardH, cardW, cardH, 10, { color: WHITE, border: LINE, borderWidth: 0.9 });
    page.drawRectangle({
      x: cardX,
      y: top - cardH + 10,
      width: 3,
      height: cardH - 20,
      color: GOLD,
    });
    spaced(`Day ${day.day}`, cardX + 16, top - 15, 6.6, f.bodyBold, TEAL, 1.4);
    text(
      wrapText(day.title, f.head, 11.5, cardW - 150)[0] ?? "",
      cardX + 16,
      top - 31,
      11.5,
      f.head,
      NAVY,
    );
    // Place + drive chips on the right.
    let chipX = cardX + cardW - 14;
    if (day.travel_km > 0) {
      const label = `Drive ${Math.round(day.travel_km)} km`;
      const w = tw(label, f.bodySemi, 7.6) + 14;
      chipX -= w;
      rr(chipX, top - 31, w, 16, 8, { color: hex("#fdf1d3") });
      text(label, chipX + 7, top - 26.4, 7.6, f.bodySemi, hex("#8a5b00"));
      chipX -= 6;
    }
    {
      const w = tw(placeName, f.bodySemi, 7.6) + 14;
      chipX -= w;
      rr(chipX, top - 31, w, 16, 8, { color: hex("#dff0f1") });
      text(placeName, chipX + 7, top - 26.4, 7.6, f.bodySemi, TEAL);
    }
    let cy = top - 52;
    for (const line of noteLines) {
      text(line, cardX + 16, cy, 9.3, f.body, INK);
      cy -= 14;
    }
    cy -= 6;
    let ax = cardX + 16;
    for (const a of activities) {
      const w = tw(a, f.body, 7.8) + 14;
      if (ax + w > cardX + cardW - 14) {
        ax = cardX + 16;
        cy -= 22;
      }
      rr(ax, cy - 6, w, 16, 8, { color: TINT });
      text(a, ax + 7, cy - 1.4, 7.8, f.body, BRAND);
      ax += w + 5;
    }
    text("OVERNIGHT", cardX + 16, top - cardH + 11, 6.2, f.bodyBold, MUTED);
    text(
      day.overnight,
      cardX + 16 + tw("OVERNIGHT", f.bodyBold, 6.2) + 10,
      top - cardH + 11,
      8.6,
      f.bodySemi,
      INK,
    );
    y = top - cardH - 12;
  }

  // ===========================================================================================
  // 5. BUDGET
  // ===========================================================================================
  newPage();
  sectionHeader(
    "04",
    "Your investment",
    "What the tour is expected to cost",
    "All prices are in Sri Lankan rupees (LKR) and are an estimate based on the choices you made.",
  );
  const bd = input.breakdown;
  const rows: Array<{ label: string; detail: string; amount: number }> = bd.stay
    ? [
        { label: "Hotels", detail: describeStay(bd), amount: bd.stay.subtotalLkr },
        { label: "Transport", detail: describeRide(bd), amount: bd.ride.subtotalLkr },
      ]
    : [];
  for (const row of rows) {
    const lines = wrapText(row.detail, f.body, 9, CW - 190);
    const rowH = Math.max(58, 30 + lines.length * 13);
    ensure(rowH + 10);
    rr(MARGIN, y - rowH, CW, rowH, 10, { color: TINT });
    text(row.label, MARGIN + 18, y - 24, 13, f.head, NAVY);
    lines.forEach((line, i) => text(line, MARGIN + 18, y - 42 - i * 13, 9, f.body, MUTED));
    textRight(formatLkr(row.amount), MARGIN + CW - 18, y - 26, 13, f.head, NAVY);
    y -= rowH + 10;
  }
  ensure(86);
  rr(MARGIN, y - 72, CW, 72, 12, { color: NAVY });
  page.drawRectangle({ x: MARGIN, y: y - 72 + 12, width: 5, height: 48, color: GOLD });
  spaced("Estimated total", MARGIN + 26, y - 28, 7.8, f.bodyBold, GOLD, 1.6);
  text(
    `${travellers} traveller${travellers === 1 ? "" : "s"}  |  ${input.quiz.days} days`,
    MARGIN + 26,
    y - 52,
    9,
    f.body,
    hex("#b9d2de"),
  );
  textRight(formatLkr(input.totalLkr), MARGIN + CW - 26, y - 48, 26, f.head, WHITE);
  y -= 72 + 22;

  // Included / not included.
  ensure(150);
  const halfW = (CW - 16) / 2;
  const included = [
    `Hotel stays as quoted (${BOARD_LABELS[input.quiz.board].toLowerCase()})`,
    bd.ride.vehicleName
      ? `${bd.ride.vehicleName}${bd.ride.mode === "driver" ? " with a driver" : " (self-drive)"}`
      : "Transport as arranged by our team",
    "Route planning by the Go Lanka team",
  ];
  const notIncluded = [
    "International flights",
    "Entrance fees, unless stated",
    "Personal spending and tips",
  ];
  const listBoxH = 24 + 3 * 18 + 14;
  for (const [col, title, items, positive] of [
    [0, "Included", included, true],
    [1, "Not included", notIncluded, false],
  ] as const) {
    const bx = MARGIN + col * (halfW + 16);
    rr(bx, y - listBoxH, halfW, listBoxH, 10, { color: WHITE, border: LINE, borderWidth: 0.9 });
    spaced(title, bx + 16, y - 20, 7.2, f.bodyBold, positive ? TEAL : MUTED, 1.5);
    items.forEach((item, i) => {
      const iy = y - 42 - i * 18;
      if (positive) {
        page.drawLine({
          start: { x: bx + 16, y: iy + 3 },
          end: { x: bx + 19.5, y: iy - 0.5 },
          thickness: 1.3,
          color: TEAL,
        });
        page.drawLine({
          start: { x: bx + 19.5, y: iy - 0.5 },
          end: { x: bx + 25, y: iy + 7 },
          thickness: 1.3,
          color: TEAL,
        });
      } else {
        page.drawLine({
          start: { x: bx + 17, y: iy + 6 },
          end: { x: bx + 24, y: iy - 1 },
          thickness: 1.2,
          color: MUTED,
        });
        page.drawLine({
          start: { x: bx + 17, y: iy - 1 },
          end: { x: bx + 24, y: iy + 6 },
          thickness: 1.2,
          color: MUTED,
        });
      }
      text(wrapText(item, f.body, 8.8, halfW - 48)[0] ?? "", bx + 32, iy, 8.8, f.body, INK);
    });
  }
  y -= listBoxH + 22;

  if (bd.notes.length) {
    for (const note of bd.notes) paragraph(note, MARGIN, CW, 8.5, f.body, MUTED, 13);
    y -= 6;
  }
  if (input.adminNotes) {
    ensure(70);
    rr(
      MARGIN,
      y - 22 - wrapText(input.adminNotes, f.body, 9.3, CW - 36).length * 14,
      CW,
      22 + wrapText(input.adminNotes, f.body, 9.3, CW - 36).length * 14 + 10,
      10,
      { color: hex("#fdf6e0") },
    );
    spaced("A note from our team", MARGIN + 18, y - 18, 6.8, f.bodyBold, hex("#8a5b00"), 1.4);
    y -= 28;
    paragraph(input.adminNotes, MARGIN + 18, CW - 36, 9.3, f.body, INK, 14);
    y -= 16;
  }

  // Next steps.
  ensure(96);
  rr(MARGIN, y - 84, CW, 84, 12, { color: hex("#e6f2f3") });
  spaced("Next steps", MARGIN + 20, y - 22, 7.2, f.bodyBold, TEAL, 1.5);
  text("Happy with this plan?", MARGIN + 20, y - 42, 12.5, f.head, NAVY);
  const contactLine = input.whatsapp
    ? `Message us on WhatsApp ${input.whatsapp} or reply to your quotation email. We confirm availability and your final price, then you can book.`
    : "Reply to your quotation email. We confirm availability and your final price, then you can book.";
  wrapText(contactLine, f.body, 9, CW - 40)
    .slice(0, 2)
    .forEach((line, i) => text(line, MARGIN + 20, y - 58 - i * 13, 9, f.body, INK));
  y -= 84 + 16;
  paragraph(
    "This itinerary was drafted with the help of AI from the information you gave us, and reviewed by the Go Lanka team. Destinations, hotels, activities and prices are subject to confirmation before booking.",
    MARGIN,
    CW,
    7.8,
    f.italic,
    MUTED,
    11.5,
  );
  if (input.packageTitle) {
    paragraph(`Route reference: ${input.packageTitle}`, MARGIN, CW, 7.8, f.body, MUTED, 11.5);
  }

  // ===========================================================================================
  // Running header and footer on every page except the cover
  // ===========================================================================================
  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    if (index === 0) return;
    page = pdfPage;
    circle(MARGIN + 3, H - 38 + 3.2, 3, GOLD);
    text("Go Lanka", MARGIN + 12, H - 38, 10, f.head, NAVY);
    textRight(`Quotation ${input.reference}`, W - MARGIN, H - 38, 8, f.bodySemi, MUTED);
    page.drawLine({
      start: { x: MARGIN, y: H - 50 },
      end: { x: W - MARGIN, y: H - 50 },
      thickness: 0.7,
      color: LINE,
    });
    page.drawLine({
      start: { x: MARGIN, y: 42 },
      end: { x: W - MARGIN, y: 42 },
      thickness: 0.7,
      color: LINE,
    });
    text("Private tours across Sri Lanka", MARGIN, 28, 7.8, f.body, MUTED);
    textRight(`Page ${index + 1} of ${pages.length}`, W - MARGIN, 28, 7.8, f.bodySemi, MUTED);
  });

  return Buffer.from(await pdf.save());
}
