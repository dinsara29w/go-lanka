import {
  SRI_LANKA_MAP_VIEWBOX,
  projectSriLankaPoint,
  sriLankaMapRegions,
} from "@/content/map-regions";

export function TourMapPins({
  destinationSlugs,
  destinations,
}: {
  destinationSlugs: string[];
  destinations: Array<{ name: string; slug: string; lat: number | null; lng: number | null }>;
}) {
  const points = [...new Set(destinationSlugs)]
    .map((slug) => destinations.find((destination) => destination.slug === slug))
    .filter(
      (destination): destination is { name: string; slug: string; lat: number; lng: number } =>
        Boolean(destination && destination.lat !== null && destination.lng !== null),
    )
    .map((destination) => ({
      ...destination,
      ...projectSriLankaPoint(destination.lat, destination.lng),
    }));

  if (points.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {points.map((point) => (
          <span
            key={point.slug}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            {point.name}
          </span>
        ))}
      </div>
      <svg
        viewBox={SRI_LANKA_MAP_VIEWBOX}
        role="img"
        aria-label={`Route map with ${points.length} destinations`}
        className="mx-auto mt-3 max-h-80 w-full"
      >
        {sriLankaMapRegions.map((region) => (
          <path
            key={region.id}
            d={region.path}
            fillRule="evenodd"
            className="fill-muted stroke-border"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {points.map((point) => (
          <g key={point.slug}>
            <circle
              cx={point.x}
              cy={point.y}
              r={7}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
            <circle cx={point.x} cy={point.y} r={2} className="fill-primary-foreground" />
          </g>
        ))}
      </svg>
    </div>
  );
}
