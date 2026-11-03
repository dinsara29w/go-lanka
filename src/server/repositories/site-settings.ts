import "server-only";

import { cache } from "react";

import { getPublicPool } from "@/server/db/pools";

export type SiteSettings = {
  whatsappNumber: string | null;
  contactEmail: string | null;
  phone: string | null;
  socials: Record<string, string>;
};

type SiteSettingsRow = {
  whatsapp_number: string | null;
  contact_email: string | null;
  phone: string | null;
  socials: Record<string, unknown> | null;
};

export const getSiteSettings = cache(async (): Promise<SiteSettings | null> => {
  const result = await getPublicPool().query<SiteSettingsRow>(
    `SELECT whatsapp_number, contact_email, phone, socials
     FROM site_settings
     WHERE singleton = true
     LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    whatsappNumber: row.whatsapp_number,
    contactEmail: row.contact_email,
    phone: row.phone,
    socials: Object.fromEntries(
      Object.entries(row.socials ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
});
