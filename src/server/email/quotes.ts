import "server-only";

import { formatLkr } from "@/lib/currency";
import { SITE_NAME, getSiteUrl } from "@/lib/site";
import { BOARD_LABELS } from "@/lib/tour-builder";
import type { BoardType } from "@/lib/validation/tour-builder";
import { describeRide, describeStay, type QuoteBreakdown } from "@/server/ai/pricing";
import { escapeHtml } from "@/server/email/templates";

export function buildAdminQuoteNotification(input: {
  reference: string;
  quoteId: string;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  travelDate: string | null;
  message?: string | null;
}): { subject: string; html: string; text: string } {
  const adminUrl = new URL(`/admin/quotes/${input.quoteId}`, getSiteUrl()).toString();

  return {
    subject: `New tour quotation ${input.reference}`,
    text: [
      "A traveller has requested a quotation from the AI tour builder.",
      "",
      `Reference: ${input.reference}`,
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Phone / WhatsApp: ${input.phone}`,
      `Country: ${input.country || "Not provided"}`,
      `Preferred start: ${input.travelDate || "Not provided"}`,
      `Message: ${input.message || "None"}`,
      "",
      `Review the quotation: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">New tour quotation</h1>
        <p>A traveller has requested a quotation from the AI tour builder.</p>
        <p><strong>Reference:</strong> ${escapeHtml(input.reference)}</p>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Phone / WhatsApp:</strong> ${escapeHtml(input.phone)}</p>
        <p><strong>Country:</strong> ${escapeHtml(input.country || "Not provided")}</p>
        <p><strong>Preferred start:</strong> ${escapeHtml(input.travelDate || "Not provided")}</p>
        <p><strong>Message:</strong> ${escapeHtml(input.message || "None")}</p>
        <p><a href="${escapeHtml(adminUrl)}">Review the quotation in the admin panel</a></p>
        <p style="font-size: 12px; color: #6b7280;">${escapeHtml(SITE_NAME)}</p>
      </div>
    `.trim(),
  };
}

export function buildCustomerQuoteEmail(input: {
  reference: string;
  name: string;
  itineraryTitle: string;
  days: number;
  nights: number;
  adults: number;
  children: number;
  board: BoardType;
  vehicleName: string | null;
  distanceKm: number;
  totalLkr: number;
  breakdown: QuoteBreakdown;
  pdfUrl: string | null;
  adminNotes?: string | null;
}): { subject: string; html: string; text: string } {
  const total = input.totalLkr;
  const pdfLine = input.pdfUrl
    ? `<p><a href="${escapeHtml(input.pdfUrl)}">Download your itinerary (PDF)</a></p>`
    : "";
  const pdfText = input.pdfUrl ? ["", `Download your itinerary: ${input.pdfUrl}`] : [];

  const packageLine = describeStay(input.breakdown);
  const rideLine = describeRide(input.breakdown);

  return {
    subject: `Your Sri Lanka itinerary and quote — ${input.reference}`,
    text: [
      `Hello ${input.name},`,
      "",
      "Thank you for using our tour builder. The team has reviewed your route and prepared this quotation.",
      "",
      `Reference: ${input.reference}`,
      `Itinerary: ${input.itineraryTitle}`,
      `Duration: ${input.days} days / ${input.nights} nights`,
      `Travellers: ${input.adults} adult(s), ${input.children} child(ren)`,
      `Board: ${BOARD_LABELS[input.board]}`,
      "",
      "Quotation",
      `- ${packageLine}`,
      `- ${rideLine}`,
      "",
      `Total: ${formatLkr(total)}`,
      "Prices are quoted in LKR. The team will confirm availability and final details before booking.",
      ...(input.adminNotes ? ["", `Note from the team: ${input.adminNotes}`] : []),
      ...pdfText,
      "",
      SITE_NAME,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">Your Sri Lanka itinerary and quote</h1>
        <p>Hello ${escapeHtml(input.name)},</p>
        <p>Thank you for using our tour builder. The team has reviewed your route and prepared this quotation.</p>
        <p><strong>Reference:</strong> ${escapeHtml(input.reference)}<br />
           <strong>Itinerary:</strong> ${escapeHtml(input.itineraryTitle)}<br />
           <strong>Duration:</strong> ${input.days} days / ${input.nights} nights<br />
           <strong>Travellers:</strong> ${input.adults} adult(s), ${input.children} child(ren)<br />
           <strong>Board:</strong> ${escapeHtml(BOARD_LABELS[input.board])}</p>
        <h2 style="font-size: 16px; margin-top: 24px;">Quotation</h2>
        <ul>
          <li>${escapeHtml(packageLine)}</li>
          <li>${escapeHtml(rideLine)}</li>
        </ul>
        <p style="font-size: 22px; font-weight: 600;">${escapeHtml(formatLkr(total))}</p>
        <p>Prices are quoted in LKR. The team will confirm availability and final details before booking.</p>
        ${input.adminNotes ? `<p><strong>Note from the team:</strong> ${escapeHtml(input.adminNotes)}</p>` : ""}
        ${pdfLine}
        <p style="font-size: 12px; color: #6b7280;">${escapeHtml(SITE_NAME)}</p>
      </div>
    `.trim(),
  };
}
