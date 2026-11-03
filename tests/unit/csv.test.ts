import { describe, expect, it } from "vitest";

import { csvCell } from "@/lib/csv";

describe("CSV cells", () => {
  it("quotes ordinary values", () => {
    expect(csvCell("normal")).toBe('"normal"');
    expect(csvCell(12)).toBe('"12"');
    expect(csvCell(null)).toBe('""');
  });

  it("escapes embedded quotes", () => {
    expect(csvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("neutralises formulas and control prefixes", () => {
    expect(csvCell("=2+2")).toBe(`"'=2+2"`);
    expect(csvCell("+SUM(A1)")).toBe(`"'+SUM(A1)"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
    expect(csvCell("\tvalue")).toBe(`"'\tvalue"`);
  });
});
