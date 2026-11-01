import { describe, expect, it } from "vitest";
import { computePayslip, payrollTotals, progressiveTax } from "./payroll";

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
});
