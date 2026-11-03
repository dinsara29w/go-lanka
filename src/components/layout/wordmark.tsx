import Link from "next/link";
import { cn } from "cn";

/** "Sri Lanka Tours" wordmark with "Lanka" highlighted. */
export function Wordmark({
  inverted = false,
  className,
}: {
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "shrink-0 rounded-md font-heading font-bold whitespace-nowrap",
        inverted ? "text-[1.375rem] text-white" : "text-[1.1875rem] text-ink",
        className,
      )}
    >
      Sri <span className={inverted ? "text-amber" : "text-brand"}>Lanka</span> Tours
    </Link>
  );
}
