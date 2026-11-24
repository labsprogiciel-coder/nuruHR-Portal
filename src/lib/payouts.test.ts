import { describe, expect, it } from "vitest";
import { batchFileRows, missingPayout, normalizeMobile, payoutBatches, payoutError } from "./payouts";
import { createSeed } from "./seed";
import type { Employee } from "./types";

describe("salary payouts", () => {
  it("reads Burkina Faso mobile numbers however they're typed", () => {
    expect(normalizeMobile("70 12 34 56")).toBe("+22670123456");
    expect(normalizeMobile("+226 70-12-34-56")).toBe("+22670123456");
    expect(normalizeMobile("0022670123456")).toBe("+22670123456");
    expect(normalizeMobile("7012345")).toBeNull();
    expect(normalizeMobile("+33 6 12 34 56 78")).toBeNull();
  });

  it("checks the account each method needs", () => {
    expect(payoutError("wave", "70 12 34 56")).toBeNull();
    expect(payoutError("orange-money", "1234")).toMatch(/8-digit/);
    expect(payoutError("wave", "")).toMatch(/Enter/);
    expect(payoutError("pi-spi", "aminata@banque")).toBeNull();
    expect(payoutError("bank", "BF042")).toMatch(/too short/);
    expect(payoutError("cash", "")).toBeNull();
  });

  const team = createSeed().team;
  const lines = Object.fromEntries(team.map((e, i) => [e.id, { toPay: (i + 1) * 100_000 }]));

  it("groups a month's salaries by payment method without losing anyone", () => {
    const batches = payoutBatches(team, lines);
    expect(batches.map((b) => b.method)).toEqual(["wave", "orange-money", "pi-spi", "bank", "cash"]);
    expect(batches.reduce((n, b) => n + b.total, 0)).toBe(Object.values(lines).reduce((n, l) => n + l.toPay, 0));
    expect(batches.reduce((n, b) => n + b.lines.length, 0)).toBe(team.length);
    // Numbers go out in international form
    expect(batches[0].lines.every((l) => /^\+226\d{8}$/.test(l.account))).toBe(true);
    // Nothing on file: paid by hand, and flagged
    expect(missingPayout(team, lines).map((e) => e.id)).toEqual(["emp-yacouba"]);
    expect(batches.at(-1)!.lines.map((l) => l.employee.id)).toEqual(["emp-yacouba"]);
  });

  it("leaves out nothing-to-pay lines and treats a bad number as missing", () => {
    const me = team.find((e) => e.id === "emp-me")!;
    const bad: Employee = { ...me, payout: { method: "wave", account: "123" } };
    expect(payoutBatches([bad], { [bad.id]: { toPay: 50_000 } })[0].method).toBe("cash");
    expect(missingPayout([bad], { [bad.id]: { toPay: 50_000 } })).toHaveLength(1);
    expect(payoutBatches([me], { [me.id]: { toPay: 0 } })).toEqual([]);
    // Chosen cash isn't "missing"
    const cash: Employee = { ...me, payout: { method: "cash", account: "" } };
    expect(missingPayout([cash], { [cash.id]: { toPay: 50_000 } })).toEqual([]);
  });

  it("writes one row per payment plus a total", () => {
    const wave = payoutBatches(team, lines)[0];
    const rows = batchFileRows(wave, "2026-11", "Nuru Workspace");
    expect(rows[0]).toEqual(["Numéro", "Montant (FCFA)", "Nom", "Motif"]);
    expect(rows).toHaveLength(wave.lines.length + 2);
    expect(rows[1][3]).toBe("Salaire 2026-11 Nuru Workspace");
    expect(rows.at(-1)![1]).toBe(wave.total);
  });
});
