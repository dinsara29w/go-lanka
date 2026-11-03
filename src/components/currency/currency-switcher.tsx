"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useCurrency } from "@/components/currency/currency-provider";
import { CURRENCIES, type Currency } from "@/lib/currency";
import { strings } from "@/content/strings";

export function CurrencySwitcher() {
  const { currency } = useCurrency();
  const router = useRouter();
  const [value, setValue] = useState<Currency>(currency);

  function change(next: Currency) {
    setValue(next);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `currency=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="sr-only">{strings.currency.label}</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value as Currency)}
        className="rounded-full border border-ink/15 bg-background/60 px-3 py-1.5 text-xs font-medium text-ink outline-none transition-colors hover:bg-sand focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        {CURRENCIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
