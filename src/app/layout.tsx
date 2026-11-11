import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { getSiteUrl, SITE_NAME } from "@/lib/site";

import "./globals.css";

// Fonts are self-hosted (latin subset, variable weight) so builds do not depend on Google.
// Both are SIL Open Font Licence; see src/fonts/*-OFL.txt.
const montserrat = localFont({
  src: [
    { path: "../fonts/montserrat-latin-wght-normal.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/montserrat-latin-wght-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

const openSans = localFont({
  src: [
    { path: "../fonts/open-sans-latin-wght-normal.woff2", style: "normal", weight: "300 800" },
    { path: "../fonts/open-sans-latin-wght-italic.woff2", style: "italic", weight: "300 800" },
  ],
  variable: "--font-open-sans",
  display: "swap",
});

const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "TODO: client to confirm the site description.",
  applicationName: SITE_NAME,
  robots: {
    index: allowIndexing,
    follow: allowIndexing,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: "TODO: client to confirm the site description.",
    url: getSiteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "TODO: client to confirm the site description.",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2b6a8c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${openSans.variable}`}>
      <body className="min-h-dvh text-foreground antialiased">{children}</body>
    </html>
  );
}
