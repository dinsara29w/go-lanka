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
          "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-colors",
          active ? "bg-tint text-brand" : "text-ink-soft hover:bg-band hover:text-ink",
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
        "border-b-2 py-1.5 whitespace-nowrap transition-colors",
        active
          ? "border-brand text-brand"
          : "border-transparent text-ink-soft hover:border-line hover:text-ink",
        className,
      )}
    >
      {label}
    </Link>
  );
}
