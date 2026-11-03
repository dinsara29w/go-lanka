import { strings } from "@/content/strings";
import { getSiteUrl, SITE_NAME } from "@/lib/site";
import { listMapDestinations } from "@/server/repositories/destinations";
import { listPublishedPackageOptions } from "@/server/repositories/packages";
import { getSiteSettings } from "@/server/repositories/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getSiteUrl();
  const [packages, destinations, settings] = await Promise.all([
    listPublishedPackageOptions(),
    listMapDestinations(),
    getSiteSettings(),
  ]);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${strings.home.description}`,
    "",
    "Sri Lanka Tours is a local tour operator planning custom and published journeys across Sri Lanka. The team handles enquiries directly; there is no third-party commission platform and no online payment in this version.",
    "",
    "## Core pages",
    `- [Home](${baseUrl}/)`,
    `- [About](${baseUrl}/about)`,
    `- [Packages](${baseUrl}/packages)`,
    `- [Interactive map](${baseUrl}/map)`,
    `- [Reviews](${baseUrl}/reviews)`,
    `- [Traveller photos](${baseUrl}/photos)`,
    `- [Travel information](${baseUrl}/travel-info)`,
    `- [AI tour builder](${baseUrl}/tour-builder)`,
    `- [Contact](${baseUrl}/contact)`,
    "",
    "## Published packages",
    ...(packages.length > 0
      ? packages.map((item) => `- [${item.title}](${baseUrl}/packages/${item.slug})`)
      : ["- No packages are published yet."]),
    "",
    "## Destinations",
    ...(destinations.length > 0
      ? destinations.map(
          (item) => `- ${item.name} (${item.region}) — ${item.description.slice(0, 180)}`,
        )
      : ["- No destinations are published yet."]),
    "",
    "## Contact",
    `- Website: ${baseUrl}`,
    ...(settings?.contactEmail ? [`- Email: ${settings.contactEmail}`] : []),
    ...(settings?.phone ? [`- Phone: ${settings.phone}`] : []),
    "",
    "## Important notes",
    "- Booking requests are manually confirmed by the team.",
    "- Converted prices are indicative.",
    "- AI-generated itineraries are suggestions and must be confirmed by the team.",
    "- Do not use the admin area or public form endpoints for automated crawling.",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
