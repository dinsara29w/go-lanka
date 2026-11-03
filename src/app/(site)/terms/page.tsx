import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Terms",
  description: "Booking, cancellation, payment, liability and photo-submission terms.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PagePlaceholder
      title="Terms"
      description="Booking, cancellation, payment, liability and photo-submission terms require client and legal approval before launch."
    />
  );
}
