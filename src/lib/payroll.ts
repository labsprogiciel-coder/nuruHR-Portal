import type { Employee } from "./types";

/**
 * Burkina Faso payroll parameters (private sector). Every figure is kept here so a change in
 * the law is a one-line edit. `verified` says how sure we are; anything not verified should be
 * checked against the current Code général des impôts and CNSS texts before real use.
 */
export const PAYROLL_RULES = {
  cnss: {
    // Décret n°2023-0129 (21.5% in total); ceiling raised to 800 000 FCFA by arrêté of August 2022.
    verified: true,
    ceiling: 800_000,
    employee: 0.055, // pension branch
    employer: { pension: 0.085, family: 0.06, workAccidents: 0.015 },
  },
  iuts: {
    // Monthly progressive scale. The first bands and the family reductions match several sources;
    // the full table could not be checked against the CGI annex.
    verified: false,
    /** Flat deduction for professional expenses, on base salary: non-executives / executives */
    abatement: { staff: 0.25, executive: 0.2 },
    /** [upper bound of the band in FCFA, rate]; the last band has no upper bound */
    brackets: [
      [30_000, 0],
      [50_000, 0.121],
      [80_000, 0.139],
      [120_000, 0.157],
      [170_000, 0.184],
      [250_000, 0.217],
      [Infinity, 0.25],
    ] as [number, number][],
    /** Reduction of the tax for 1, 2, 3 and 4+ dependents (CGI art. 113: at most 4 count) */
    familyReduction: [0, 0.08, 0.1, 0.12, 0.14],
  },
} as const;

export type Payslip = {
  gross: number;
  cnssBase: number;
  cnssEmployee: number;
  abatement: number;
  /** Taxable income after CNSS and the flat deduction, rounded down to the hundred */
  taxable: number;
  iutsBeforeReduction: number;
  familyReduction: number;
  iuts: number;
  net: number;
  cnssEmployer: number;
  /** What the employee costs the company this month */
  employerCost: number;
};

const round = (n: number) => Math.round(n);

/** Progressive tax on a monthly taxable amount. */
export function progressiveTax(taxable: number, brackets: readonly (readonly [number, number])[] = PAYROLL_RULES.iuts.brackets) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

/** One month's pay for an employee on base salary only (no allowances or overtime yet). */
export function computePayslip(e: Pick<Employee, "monthlySalary" | "dependents" | "executive">): Payslip {
  const { cnss, iuts } = PAYROLL_RULES;
  const gross = e.monthlySalary;
  const cnssBase = Math.min(gross, cnss.ceiling);
  const cnssEmployee = round(cnssBase * cnss.employee);
  const abatement = round(gross * (e.executive ? iuts.abatement.executive : iuts.abatement.staff));
  const taxable = Math.max(0, Math.floor((gross - cnssEmployee - abatement) / 100) * 100);
  const iutsBeforeReduction = round(progressiveTax(taxable));
  const share = iuts.familyReduction[Math.min(e.dependents, iuts.familyReduction.length - 1)];
  const familyReduction = round(iutsBeforeReduction * share);
  const iutsDue = iutsBeforeReduction - familyReduction;
  const employerRate = cnss.employer.pension + cnss.employer.family + cnss.employer.workAccidents;
  const cnssEmployer = round(cnssBase * employerRate);
  return {
    gross,
    cnssBase,
    cnssEmployee,
    abatement,
    taxable,
    iutsBeforeReduction,
    familyReduction,
    iuts: iutsDue,
    net: gross - cnssEmployee - iutsDue,
    cnssEmployer,
    employerCost: gross + cnssEmployer,
  };
}

export type PayrollTotals = Pick<Payslip, "gross" | "cnssEmployee" | "cnssEmployer" | "iuts" | "net" | "employerCost">;

export function payrollTotals(slips: Payslip[]): PayrollTotals {
  const t: PayrollTotals = { gross: 0, cnssEmployee: 0, cnssEmployer: 0, iuts: 0, net: 0, employerCost: 0 };
  for (const s of slips) for (const k of Object.keys(t) as (keyof PayrollTotals)[]) t[k] += s[k];
  return t;
}
