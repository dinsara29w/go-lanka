import { cn } from "cn";

// An eight-point compass star like the one in the logo: four long points (N, E, S, W)
// and four short diagonals.
function starPoints(cx: number, cy: number, long: number, short: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const angle = (i * 22.5 - 90) * (Math.PI / 180);
    const radius = i % 4 === 0 ? long : i % 4 === 2 ? short : inner;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(" ");
}

const SMALL_STAR = starPoints(12, 12, 12, 7.4, 3.1);
const BIG_STAR = starPoints(100, 100, 92, 56, 22);

/** Small star used as a bullet beside eyebrows and labels. */
export function CompassStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-3.5", className)}>
      <polygon points={SMALL_STAR} fill="currentColor" />
    </svg>
  );
}

/** Large outlined compass used as a faint watermark on dark panels. */
export function CompassWatermark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      fill="none"
      stroke="currentColor"
    >
      <circle cx="100" cy="100" r="97" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="76" strokeWidth="1.2" />
      <polygon points={BIG_STAR} fill="currentColor" stroke="none" opacity="0.55" />
      <g strokeWidth="1.2" opacity="0.7">
        <path d="M100 3v14M100 183v14M3 100h14M183 100h14" />
      </g>
    </svg>
  );
}
