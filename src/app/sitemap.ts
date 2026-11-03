import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";
import { listPublishedPackageSitemapEntries } from "@/server/repositories/packages";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const routes = [
    "/",
    "/about",
    "/packages",
    "/map",
    "/reviews",
    "/photos",
    "/travel-info",
    "/tour-builder",
    "/contact",
    "/privacy",
    "/terms",
  ];
  const packages = await listPublishedPackageSitemapEntries();

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/packages" ? 0.8 : 0.5,
  }));

  const packageEntries: MetadataRoute.Sitemap = packages.map((item) => ({
    url: new URL(`/packages/${item.slug}`, baseUrl).toString(),
    lastModified: item.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...packageEntries];
}
