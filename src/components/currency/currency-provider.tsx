"use client";

import { createContext, useContext } from "react";

import { type Currency, type ExchangeRates, formatConvertedPrice, formatLkr } from "@/lib/currency";

type CurrencyContextValue = {
  currency: Currency;
  rates: ExchangeRates | null;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "LKR",
  rates: null,
});

export function CurrencyProvider({
  value,
  children,
}: {
  value: CurrencyContextValue;
  children: React.ReactNode;
}) {
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

export function Price({ amountLkr }: { amountLkr: number }) {
  const { currency, rates } = useCurrency();
  const formatted = formatConvertedPrice(amountLkr, currency, rates);
  return <>{formatted ?? formatLkr(amountLkr)}</>;
}
