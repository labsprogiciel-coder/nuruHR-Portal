import { describe, expect, it } from "vitest";
import { advanceSchedule, computePayslip, normalizeSlip, payrollTotals, progressiveTax, repaidBefore, variablePay } from "./payroll";

describe("Burkina Faso payroll", () => {
  it("caps CNSS at 800 000 FCFA and applies the scale and family reduction", () => {
    // 850 000 FCFA, non-executive, 1 dependent
    const s = computePayslip({ monthlySalary: 850_000, dependents: 1 });
    expect(s.cnssBase).toBe(800_000);
    expect(s.cnssEmployee).toBe(44_000); // 5.5%
    expect(s.abatement).toBe(212_500); // 25% of base
    expect(s.taxable).toBe(593_500);
    // 0 + 2 420 + 4 170 + 6 280 + 9 200 + 17 360 + 85 875
    expect(s.iutsBeforeReduction).toBe(125_305);
    expect(s.familyReduction).toBe(10_024); // 8% for one dependent
    expect(s.iuts).toBe(115_281);
    expect(s.net).toBe(690_719);
    expect(s.cnssEmployer).toBe(128_000); // 16% of the capped base
    expect(s.employerCost).toBe(978_000);
  });

  it("rounds taxable income down to the hundred", () => {
    // 150 000 FCFA, no dependents: 150 000 − 8 250 − 37 500 = 104 250 → 104 200
    const s = computePayslip({ monthlySalary: 150_000, dependents: 0 });
    expect(s.taxable).toBe(104_200);
    expect(s.iuts).toBe(10_389);
    expect(s.net).toBe(131_361);
  });

  it("gives executives the smaller deduction and counts at most four dependents", () => {
    const exec = computePayslip({ monthlySalary: 1_000_000, dependents: 6, executive: true });
    expect(exec.abatement).toBe(200_000); // 20%
    expect(exec.familyReduction).toBe(Math.round(exec.iutsBeforeReduction * 0.14));
  });

  it("taxes nothing up to 30 000 FCFA and sums totals", () => {
    expect(progressiveTax(30_000)).toBe(0);
    const slips = [computePayslip({ monthlySalary: 850_000, dependents: 1 }), computePayslip({ monthlySalary: 150_000, dependents: 0 })];
    const t = payrollTotals(slips);
    expect(t.gross).toBe(1_000_000);
    expect(t.net).toBe(690_719 + 131_361);
  });

  it("taxes allowances above their exempt share", () => {
    // Housing exempt up to 20% of base (cap 75 000), transport up to 5% (cap 30 000)
    const s = computePayslip({ monthlySalary: 400_000, dependents: 0, allowances: { housing: 100_000, transport: 30_000 } });
    expect(s.gross).toBe(530_000);
    expect(s.exempt).toBe(75_000 + 20_000);
    expect(s.cnssEmployee).toBe(29_150); // CNSS on the whole gross
    expect(s.abatement).toBe(100_000); // flat deduction on base salary only
    expect(s.taxable).toBe(305_800);
    expect(s.iuts).toBe(53_380);
    expect(s.net).toBe(447_470);
    expect(s.toPay).toBe(447_470);
  });

  it("prices overtime, bonus and unpaid absence from the base salary", () => {
    // 173 330 FCFA → 1 000 FCFA an hour
    expect(variablePay(173_330, { overtime15: 10, overtime35: 4, bonus: 25_000 })).toEqual({ overtime: 11_500 + 5_400, bonus: 25_000, absence: 0 });
    expect(variablePay(300_000, { absenceDays: 3 }).absence).toBe(30_000);
    const s = computePayslip({ monthlySalary: 300_000, dependents: 0 }, { absenceDays: 3, bonus: 50_000 });
    expect(s.gross).toBe(320_000);
    expect(s.abatement).toBe(67_500); // 25% of the base actually paid
  });

  it("withholds advance repayments from the net, never below zero", () => {
    const s = computePayslip({ monthlySalary: 150_000, dependents: 0 }, {}, 50_000);
    expect(s.advance).toBe(50_000);
    expect(s.toPay).toBe(s.net - 50_000);
    const capped = computePayslip({ monthlySalary: 40_000, dependents: 0 }, {}, 1_000_000);
    expect(capped.advance).toBe(capped.net);
    expect(capped.toPay).toBe(0);
  });

  it("repays the oldest advance first and starts each one in its first month", () => {
    const a = { id: "a", employeeId: "e", amount: 100_000, date: "2026-09-20", installment: 30_000, firstMonth: "2026-10" };
    const b = { id: "b", employeeId: "e", amount: 50_000, date: "2026-11-02", installment: 20_000, firstMonth: "2026-12" };
    const dec = advanceSchedule([b, a], 90_000, "2026-12");
    expect(dec.rows.map((r) => [r.advance.id, r.remaining, r.thisMonth])).toEqual([
      ["a", 10_000, 10_000],
      ["b", 50_000, 20_000],
    ]);
    expect(dec.due).toBe(30_000);
    expect(advanceSchedule([a, b], 90_000, "2026-11").due).toBe(10_000);
    const runs = {
      "2026-10": { month: "2026-10", status: "paid" as const, validatedAt: "", lines: { e: computePayslip({ monthlySalary: 500_000, dependents: 0 }, {}, 30_000) } },
      "2026-11": { month: "2026-11", status: "validated" as const, validatedAt: "" },
    };
    expect(repaidBefore(runs, "e", "2026-11")).toBe(30_000);
    expect(repaidBefore(runs, "e", "2026-10")).toBe(0);
  });

  it("reads payslips frozen before allowances and advances", () => {
    const old = normalizeSlip({ gross: 500_000, net: 420_000 });
    expect(old.toPay).toBe(420_000);
    expect(old.advance).toBe(0);
    expect(old.base).toBe(500_000);
  });
});
