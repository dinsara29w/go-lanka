import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-20 sm:px-6">
      <p className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {strings.common.comingSoon}
      </p>
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-base leading-7 text-muted-foreground">{description}</p>
      </div>
      <p className="text-sm text-muted-foreground">{strings.common.placeholderNote}</p>
      <Button asChild variant="outline">
        <Link href="/">{strings.common.backHome}</Link>
      </Button>
    </section>
  );
}
