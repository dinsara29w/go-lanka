import { getSiteUrl } from "@/lib/site";
import { getSiteSettings } from "@/server/repositories/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  const contactEmail = settings?.contactEmail ?? "admin@golanka.com";
  const baseUrl = getSiteUrl();

  const lines = [
    `Contact: mailto:${contactEmail}`,
    `Canonical: ${baseUrl}/.well-known/security.txt`,
    "Preferred-Languages: en",
    "Expires: 2027-10-22T00:00:00.000Z",
    "",
    "Please report suspected vulnerabilities privately. Do not test against production data or disrupt bookings.",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
