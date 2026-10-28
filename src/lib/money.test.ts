import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats CFA francs as whole francs with spaced thousands", () => {
    expect(formatMoney(1_250_000)).toBe("1 250 000 FCFA");
    expect(formatMoney(2_500.6, "XOF")).toBe("2 501 FCFA");
    expect(formatMoney(0, "XAF")).toBe("0 FCFA");
  });

  it("keeps symbols for other currencies", () => {
    expect(formatMoney(1250, "EUR")).toBe("€1,250.00");
    expect(formatMoney(1250.4, "USD", { whole: true })).toBe("$1,250");
  });
});
