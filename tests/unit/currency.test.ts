import { describe, expect, it } from "vitest";

import {
  convertFromLkr,
  currencyFromCountry,
  formatConvertedPrice,
  parseCurrency,
} from "@/lib/currency";

const rates = { usd: 300, eur: 325, gbp: 380, fetchedAt: new Date() };

describe("currency conversion", () => {
  it("parses allowed currency codes", () => {
    expect(parseCurrency("USD")).toBe("USD");
    expect(parseCurrency("JPY")).toBeNull();
    expect(parseCurrency(null)).toBeNull();
  });

  it("maps common countries", () => {
    expect(currencyFromCountry("LK")).toBe("LKR");
    expect(currencyFromCountry("US")).toBe("USD");
    expect(currencyFromCountry("GB")).toBe("GBP");
    expect(currencyFromCountry("DE")).toBe("EUR");
    expect(currencyFromCountry("AU")).toBeNull();
  });

  it("converts LKR using stored LKR-per-unit rates", () => {
    expect(convertFromLkr(30000, "USD", rates)).toBe(100);
    expect(convertFromLkr(30000, "LKR", rates)).toBe(30000);
    expect(convertFromLkr(30000, "USD", null)).toBeNull();
  });

  it("formats converted prices", () => {
    expect(formatConvertedPrice(30000, "USD", rates)).toContain("100");
    expect(formatConvertedPrice(30000, "USD", null)).toBeNull();
    // Per-km rates stay readable after conversion instead of rounding to $0.
    expect(formatConvertedPrice(100, "USD", rates)).toMatch(/\$0\.\d\d/);
  });
});
