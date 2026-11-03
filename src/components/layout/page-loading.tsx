import { strings } from "@/content/strings";

export function PageLoading({ cards = 3 }: { cards?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{strings.common.loading}</span>
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-5 h-12 max-w-xl animate-pulse rounded bg-muted" />
      <div className="mt-4 h-5 max-w-2xl animate-pulse rounded bg-muted" />
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-2xl border border-border bg-muted/50"
          />
        ))}
      </div>
    </div>
  );
}
