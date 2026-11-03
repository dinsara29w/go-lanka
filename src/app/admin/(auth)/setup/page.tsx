import type { Metadata } from "next";
import Link from "next/link";

import { strings } from "@/content/strings";
import { beginAdminSetup } from "@/server/auth/setup";

import { AdminSetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin setup",
  robots: { index: false, follow: false },
};

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const setup = token ? await beginAdminSetup(token) : null;

  if (!setup) {
    return (
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.admin.setupTitle}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.setupTokenInvalid}</p>
        <Link
          href="/admin/login"
          className="text-sm font-medium underline underline-offset-4 hover:text-foreground"
        >
          {strings.admin.signIn}
        </Link>
      </div>
    );
  }

  return <AdminSetupForm token={token} email={setup.email} qrDataUrl={setup.qrDataUrl} />;
}
