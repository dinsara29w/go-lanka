import "server-only";

import { SITE_NAME, getSiteUrl } from "@/lib/site";
import { escapeHtml } from "@/server/email/templates";

export type BookingEmailData = {
  reference: string;
  packageTitle: string;
  travelDate: string;
  adults: number;
  children: number;
  name: string;
  email: string;
  phone: string;
  country: string;
  message?: string;
  bookingId: string;
};

export function buildCustomerBookingEmail(data: BookingEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: `Booking request received — ${data.reference}`,
    text: [
      `Hello ${data.name},`,
      "",
      `We received your booking request for ${data.packageTitle}.`,
      `Travel date: ${data.travelDate}`,
      `Party: ${data.adults} adult${data.adults === 1 ? "" : "s"}, ${data.children} ${data.children === 1 ? "child" : "children"}`,
      `Reference: ${data.reference}`,
      "",
      "This is a request, not a confirmed booking. The team will contact you to confirm availability and the final details.",
      "",
      SITE_NAME,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">Booking request received</h1>
        <p>Hello ${escapeHtml(data.name)},</p>
        <p>We received your booking request for <strong>${escapeHtml(data.packageTitle)}</strong>.</p>
        <p><strong>Travel date:</strong> ${escapeHtml(data.travelDate)}</p>
        <p><strong>Party:</strong> ${data.adults} adult${data.adults === 1 ? "" : "s"}, ${data.children} ${data.children === 1 ? "child" : "children"}</p>
        <p><strong>Reference:</strong> ${escapeHtml(data.reference)}</p>
        <p>This is a request, not a confirmed booking. The team will contact you to confirm availability and the final details.</p>
        <p style="font-size: 12px; color: #6b7280;">${escapeHtml(SITE_NAME)}</p>
      </div>
    `.trim(),
  };
}

export function buildAdminBookingEmail(data: BookingEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const adminUrl = new URL(`/admin/bookings/${data.bookingId}`, getSiteUrl()).toString();

  return {
    subject: `New booking request — ${data.reference}`,
    text: [
      "New booking request",
      "",
      `Package: ${data.packageTitle}`,
      `Travel date: ${data.travelDate}`,
      `Party: ${data.adults} adults, ${data.children} children`,
      `Reference: ${data.reference}`,
      "",
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      `Country: ${data.country}`,
      `Message: ${data.message || "None"}`,
      "",
      `Open in admin: ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
        <h1 style="font-size: 20px;">New booking request</h1>
        <p><strong>Package:</strong> ${escapeHtml(data.packageTitle)}</p>
        <p><strong>Travel date:</strong> ${escapeHtml(data.travelDate)}</p>
        <p><strong>Party:</strong> ${data.adults} adults, ${data.children} children</p>
        <p><strong>Reference:</strong> ${escapeHtml(data.reference)}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
        <p><strong>Country:</strong> ${escapeHtml(data.country)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(data.message || "None")}</p>
        <p><a href="${escapeHtml(adminUrl)}">Open booking in admin</a></p>
      </div>
    `.trim(),
  };
}
