"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function NavLink({
  href,
  label,
  className,
  mobile = false,
}: {
  href: string;
  label: string;
  className?: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (mobile) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center justify-between rounded-xl px-3 py-3 text-sm transition-colors",
          active
            ? "bg-sand font-medium text-ocean"
            : "text-ink/70 hover:bg-sand/70 hover:text-ink",
          className,
        )}
      >
        {label}
        {active ? <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" /> : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative rounded-sm py-2 text-sm transition-colors",
        active ? "text-ocean" : "text-ink/70 hover:text-ink",
        className,
      )}
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 -bottom-0.5 h-px origin-left bg-gold transition-transform duration-300",
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
