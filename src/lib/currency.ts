export const CURRENCIES = ["LKR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type ExchangeRates = {
  usd: number;
  eur: number;
  gbp: number;
  fetchedAt: Date;
};

export function parseCurrency(value: string | null | undefined): Currency | null {
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : null;
}

export function currencyFromCountry(country: string | null | undefined): Currency | null {
  switch (country?.toUpperCase()) {
    case "LK":
      return "LKR";
    case "US":
      return "USD";
    case "GB":
      return "GBP";
    case "AT":
    case "BE":
    case "CY":
    case "DE":
    case "EE":
    case "ES":
    case "FI":
    case "FR":
    case "GR":
    case "HR":
    case "IE":
    case "IT":
    case "LT":
    case "LU":
    case "LV":
    case "MT":
    case "NL":
    case "PT":
    case "SI":
    case "SK":
      return "EUR";
    default:
      return null;
  }
}

export function lkrPerUnit(currency: Currency, rates: ExchangeRates | null): number | null {
  if (currency === "LKR") return 1;
  if (!rates) return null;
  switch (currency) {
    case "USD":
      return rates.usd;
    case "EUR":
      return rates.eur;
    case "GBP":
      return rates.gbp;
  }
}

export function convertFromLkr(
  amountLkr: number,
  currency: Currency,
  rates: ExchangeRates | null,
): number | null {
  const rate = lkrPerUnit(currency, rates);
  if (rate === null) return null;
  return amountLkr / rate;
}

export function formatCurrency(amount: number, currency: Currency): string {
  // Small converted amounts (e.g. a per-km rate in USD) keep their cents so they don't round to 0.
  const fractionDigits = currency !== "LKR" && amount > 0 && amount < 100 ? 2 : 0;
  return new Intl.NumberFormat(currency === "LKR" ? "en-LK" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatConvertedPrice(
  amountLkr: number,
  currency: Currency,
  rates: ExchangeRates | null,
): string | null {
  const converted = convertFromLkr(amountLkr, currency, rates);
  return converted === null ? null : formatCurrency(converted, currency);
}

export function formatLkr(amount: number): string {
  return formatCurrency(amount, "LKR");
}

export function formatDuration(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
