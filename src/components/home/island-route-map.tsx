import Link from "next/link";

import {
  SRI_LANKA_MAP_VIEWBOX,
  projectSriLankaPoint,
  sriLankaMapRegions,
} from "@/content/map-regions";
import { mainPlaces } from "@/content/places";
import { strings } from "@/content/strings";

/** The island with the eight main places joined by a dotted example loop, plus a numbered list. */
export function IslandRouteMap() {
  const points = mainPlaces.map((place) => ({
    ...place,
    ...projectSriLankaPoint(place.lat, place.lng),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[2rem] border border-line bg-white p-5 shadow-card sm:p-7">
        <svg
          viewBox={SRI_LANKA_MAP_VIEWBOX}
          role="img"
          aria-label={`${strings.home.island.routeLabel}: ${points.map((p) => p.name).join(", ")}`}
          className="mx-auto h-auto max-h-[30rem] w-full"
        >
          {sriLankaMapRegions.map((region) => (
            <path
              key={region.id}
              d={region.path}
              fillRule="evenodd"
              className="fill-tint stroke-brand/30"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={path}
            fill="none"
            className="stroke-gold"
            strokeWidth={3}
            strokeDasharray="2 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => (
            <g key={point.slug}>
              <circle
                cx={point.x}
                cy={point.y}
                r={11}
                className="fill-brand stroke-white"
                strokeWidth={2.5}
              />
              <text
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white text-[11px] font-bold"
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-xs font-semibold tracking-[0.12em] text-stone uppercase">
          {strings.home.island.routeLabel}
        </p>
      </div>

      <div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {mainPlaces.map((place, index) => (
            <li key={place.slug}>
              <Link
                href={`/tour-builder?places=${place.slug}`}
                className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 transition-colors hover:border-brand"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <b className="block text-sm text-ink">{place.name}</b>
                  <span className="text-xs text-stone">{place.region}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <Link href="/map" className="btn-outline btn-sm mt-6">
          {strings.home.island.openMap}
        </Link>
      </div>
    </div>
  );
}
