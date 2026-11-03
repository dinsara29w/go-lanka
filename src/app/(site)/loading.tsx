import { strings } from "@/content/strings";

/**
 * Route-level loading boundary for public pages. Besides the skeleton, it lets
 * Next prefetch the shared shell so navigation paints immediately instead of
 * waiting for a cold server render.
 */
export default function SiteLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-12 max-w-xl animate-pulse rounded bg-muted" />
      <div className="mt-4 h-5 max-w-2xl animate-pulse rounded bg-muted" />
      <div className="mt-10 h-72 rounded-2xl border border-border bg-muted/50" />
    </div>
  );
}
