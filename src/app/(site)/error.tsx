"use client";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

export default function SiteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        {strings.common.errorTitle}
      </h1>
      <p className="text-base leading-7 text-muted-foreground">{strings.common.errorBody}</p>
      <Button type="button" onClick={reset}>
        {strings.common.tryAgain}
      </Button>
    </section>
  );
}
