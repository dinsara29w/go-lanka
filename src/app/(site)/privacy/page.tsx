import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/layout/page-placeholder";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How booking enquiries, email delivery, AI itineraries and photo submissions are handled.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PagePlaceholder
      title="Privacy policy"
      description="A legally reviewed privacy policy is required before launch. It will describe booking data, email delivery, AI processing, retention and data-subject requests."
    />
  );
}
