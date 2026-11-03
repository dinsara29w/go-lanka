import Link from "next/link";

import { Button } from "@/components/ui/button";
import { strings } from "@/content/strings";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-4 py-20 sm:px-6">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        {strings.common.notFoundTitle}
      </h1>
      <p className="text-base leading-7 text-muted-foreground">{strings.common.notFoundBody}</p>
      <Button asChild>
        <Link href="/">{strings.common.backHome}</Link>
      </Button>
    </main>
  );
}
