import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";
import { requireAdmin } from "@/server/auth/require-admin";
import { readSetupRecoveryCodes } from "@/server/auth/setup-cookies";

import { finishRecoveryAction } from "../../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recovery codes",
  robots: { index: false, follow: false },
};

export default async function AdminRecoveryCodesPage() {
  const session = await requireAdmin();
  const codes = await readSetupRecoveryCodes();
  if (!codes) redirect("/admin");

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {strings.admin.recoveryTitle}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{strings.admin.recoveryBody}</p>
      </div>

      <ul className="grid gap-2 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <form action={finishRecoveryAction}>
        <input type="hidden" name="_csrf" value={session.csrfToken} />
        <Button type="submit" className="w-full">
          {strings.admin.continueToAdmin}
        </Button>
      </form>
    </div>
  );
}
