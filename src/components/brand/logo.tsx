import Link from "next/link";
import { cn } from "cn";

import { strings } from "@/content/strings";

// The logo is a traced vector of the client's artwork: public/brand/golanka-logo.svg.
const LOGO_RATIO = 920 / 891;

export function LogoMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    // Plain <img>: next/image does not optimise SVG, and this file is already small.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/golanka-logo.svg"
      alt=""
      width={Math.round(size * LOGO_RATIO)}
      height={size}
      decoding="async"
      className={cn("shrink-0", className)}
    />
  );
}

/** Logo mark with the "Go Lanka" wordmark; links home. */
export function Logo({
  inverted = false,
  size = 48,
  className,
}: {
  inverted?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label={`${strings.common.siteName} – ${strings.common.backHome}`}
      className={cn("group inline-flex items-center gap-3 rounded-lg", className)}
    >
      <LogoMark
        size={size}
        className="transition-transform duration-300 group-hover:-rotate-3 motion-reduce:transition-none"
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-[1.5rem] font-semibold tracking-tight",
            inverted ? "text-white" : "text-ink",
          )}
        >
          Go <span className={inverted ? "text-gold" : "text-brand"}>Lanka</span>
        </span>
        <span
          className={cn(
            "mt-1.5 text-[0.625rem] font-bold tracking-[0.22em] uppercase",
            inverted ? "text-white/60" : "text-stone",
          )}
        >
          {strings.site.wordmarkSub}
        </span>
      </span>
    </Link>
  );
}
