import Link from "next/link";

import { logoutAction } from "@/app/admin/actions";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import type { CurrentSession } from "@/server/auth/sessions";

const baseNavigation = [
  { href: "/admin", label: strings.admin.dashboard },
  { href: "/admin/packages", label: strings.admin.packages },
  { href: "/admin/quotes", label: strings.admin.quotes },
  { href: "/admin/rates", label: strings.admin.rates },
  { href: "/admin/destinations", label: strings.admin.destinations },
  { href: "/admin/availability", label: strings.admin.availability },
  { href: "/admin/bookings", label: strings.admin.bookings },
  { href: "/admin/reviews", label: strings.admin.reviews },
  { href: "/admin/photos", label: strings.admin.photos },
  { href: "/admin/travel-info", label: strings.admin.travelInfo },
  { href: "/admin/settings", label: strings.admin.settings },
  { href: "/admin/sessions", label: strings.admin.sessions },
];

export function AdminShell({
  session,
  children,
}: {
  session: CurrentSession;
  children: React.ReactNode;
}) {
  const navigation = [
    ...baseNavigation,
    ...(session.admin.role === "owner"
      ? [
          { href: "/admin/team", label: strings.admin.team },
          { href: "/admin/audit", label: strings.admin.audit },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 font-heading text-lg font-semibold"
            >
              <LogoMark size={36} />
              <span>
                {strings.common.siteName}{" "}
                <span className="text-muted-foreground">/ {strings.admin.area}</span>
              </span>
            </Link>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground lg:hidden"
            >
              {strings.admin.backToSite}
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-muted-foreground">
              {session.admin.email} · {session.admin.role}
            </div>
            <Link
              href="/"
              className="hidden text-sm text-muted-foreground hover:text-foreground lg:block"
            >
              {strings.admin.backToSite}
            </Link>
            <form action={logoutAction}>
              <input type="hidden" name="_csrf" value={session.csrfToken} />
              <Button type="submit" variant="outline" size="sm">
                {strings.admin.logout}
              </Button>
            </form>
          </div>
        </div>

        <nav
          aria-label="Admin navigation"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
