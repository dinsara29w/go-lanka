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
    <label className="flex items-center">
      <span className="sr-only">{strings.currency.label}</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value as Currency)}
        className="h-10 rounded-xl border border-line bg-white px-2.5 text-[0.8125rem] font-semibold text-ink-soft outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
