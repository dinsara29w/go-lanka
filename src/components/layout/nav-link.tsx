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
          "flex items-center rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors",
          active ? "bg-tint text-brand-dark" : "text-ink-soft hover:bg-band hover:text-ink",
          className,
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3.5 py-2 whitespace-nowrap transition-colors",
        active ? "bg-tint text-brand-dark" : "text-ink-soft hover:bg-band hover:text-ink",
        className,
      )}
    >
      {label}
    </Link>
  );
}
