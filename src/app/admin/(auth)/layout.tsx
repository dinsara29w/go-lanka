import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { strings } from "@/content/strings";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-muted/30">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo size={44} />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            {strings.admin.backToSite}
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
