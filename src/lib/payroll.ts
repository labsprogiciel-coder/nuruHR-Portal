import type { Advance, AllowanceKind, Employee, PayrollInput, PayrollRun } from "./types";

/**
 * Burkina Faso payroll parameters (private sector). Every figure is kept here so a change in
 * the law is a one-line edit. `verified` says how sure we are; anything not verified should be
 * checked against the current Code général des impôts, Labour Code and CNSS texts before real use.
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
    /**
     * Part of each allowance left out of IUTS: a share of base salary, up to a monthly cap.
     * The rest is taxed like salary. "other" allowances are fully taxable. To verify.
     */
    exempt: {
      housing: { share: 0.2, cap: 75_000 },
      transport: { share: 0.05, cap: 30_000 },
      function: { share: 0.05, cap: 50_000 },
    } as Partial<Record<AllowanceKind, { share: number; cap: number }>>,
  },
  time: {
    // 40-hour week: 40 × 52 ÷ 12. Overtime premiums for the first hours and beyond. To verify.
    verified: false,
    monthlyHours: 173.33,
    overtime: { first: 0.15, beyond: 0.35 },
    /** Unpaid absence is taken off at base salary ÷ this many days */
    daysPerMonth: 30,
  },
} as const;

export const ALLOWANCES: { kind: AllowanceKind; label: string; french: string }[] = [
  { kind: "housing", label: "Housing", french: "Indemnité de logement" },
  { kind: "transport", label: "Transport", french: "Indemnité de transport" },
  { kind: "function", label: "Function", french: "Indemnité de fonction" },
  { kind: "other", label: "Other", french: "Autres indemnités" },
];

export type Payslip = {
  /** Base salary for the month */
  base: number;
  /** Recurring allowances, by kind */
  allowances: Partial<Record<AllowanceKind, number>>;
  overtime: number;
  bonus: number;
  /** Taken off for unpaid absence (a positive amount) */
  absence: number;
  /** base + allowances + overtime + bonus − absence */
  gross: number;
  cnssBase: number;
  cnssEmployee: number;
  /** Part of the allowances left out of IUTS */
  exempt: number;
  abatement: number;
  /** Taxable income after the exempt allowances, CNSS and the flat deduction, rounded down to the hundred */
  taxable: number;
  iutsBeforeReduction: number;
  familyReduction: number;
  iuts: number;
  /** Net salary: gross − employee CNSS − IUTS */
  net: number;
  /** Salary advance repaid this month, withheld from the net */
  advance: number;
  /** What the employee actually receives */
  toPay: number;
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

/** What one month's inputs are worth before tax: overtime pay and the absence deduction. */
export function variablePay(base: number, input: PayrollInput = {}) {
  const { time } = PAYROLL_RULES;
  const hourly = base / time.monthlyHours;
  const overtime = round(hourly * ((input.overtime15 ?? 0) * (1 + time.overtime.first) + (input.overtime35 ?? 0) * (1 + time.overtime.beyond)));
  const absence = round(Math.min(time.daysPerMonth, input.absenceDays ?? 0) * (base / time.daysPerMonth));
  return { overtime, bonus: round(input.bonus ?? 0), absence };
}

/**
 * One month's pay for an employee: base salary, recurring allowances, the month's overtime,
 * bonus and unpaid absence, then CNSS and IUTS, and finally any salary advance repayment
 * (`advanceDue`, capped so the employee is never paid less than nothing).
 */
export function computePayslip(
  e: Pick<Employee, "monthlySalary" | "dependents" | "executive" | "allowances">,
  input: PayrollInput = {},
  advanceDue = 0,
): Payslip {
  const { cnss, iuts } = PAYROLL_RULES;
  const base = e.monthlySalary;
  const allowances: Payslip["allowances"] = {};
  let allowanceTotal = 0;
  let exempt = 0;
  for (const { kind } of ALLOWANCES) {
    const amount = round(e.allowances?.[kind] ?? 0);
    if (amount <= 0) continue;
    allowances[kind] = amount;
    allowanceTotal += amount;
    const rule = iuts.exempt[kind];
    if (rule) exempt += Math.min(amount, round(base * rule.share), rule.cap);
  }
  const { overtime, bonus, absence } = variablePay(base, input);
  const gross = Math.max(0, base + allowanceTotal + overtime + bonus - absence);
  const cnssBase = Math.min(gross, cnss.ceiling);
  const cnssEmployee = round(cnssBase * cnss.employee);
  const abatement = round(Math.max(0, base - absence) * (e.executive ? iuts.abatement.executive : iuts.abatement.staff));
  const taxable = Math.max(0, Math.floor((gross - exempt - cnssEmployee - abatement) / 100) * 100);
  const iutsBeforeReduction = round(progressiveTax(taxable));
  const share = iuts.familyReduction[Math.min(e.dependents, iuts.familyReduction.length - 1)];
  const familyReduction = round(iutsBeforeReduction * share);
  const iutsDue = iutsBeforeReduction - familyReduction;
  const employerRate = cnss.employer.pension + cnss.employer.family + cnss.employer.workAccidents;
  const cnssEmployer = round(cnssBase * employerRate);
  const net = gross - cnssEmployee - iutsDue;
  const advance = Math.max(0, Math.min(round(advanceDue), net));
  return {
    base,
    allowances,
    overtime,
    bonus,
    absence,
    gross,
    cnssBase,
    cnssEmployee,
    exempt,
    abatement,
    taxable,
    iutsBeforeReduction,
    familyReduction,
    iuts: iutsDue,
    net,
    advance,
    toPay: net - advance,
    cnssEmployer,
    employerCost: gross + cnssEmployer,
  };
}

/** Payslips frozen before allowances and advances existed: read them with the new fields. */
export function normalizeSlip(s: Partial<Payslip> & Pick<Payslip, "gross" | "net">): Payslip {
  return {
    base: s.gross,
    allowances: {},
    overtime: 0,
    bonus: 0,
    absence: 0,
    cnssBase: 0,
    cnssEmployee: 0,
    exempt: 0,
    abatement: 0,
    taxable: 0,
    iutsBeforeReduction: 0,
    familyReduction: 0,
    iuts: 0,
    advance: 0,
    toPay: s.net,
    cnssEmployer: 0,
    employerCost: s.gross,
    ...s,
  } as Payslip;
}

export type PayrollTotals = Pick<Payslip, "gross" | "cnssEmployee" | "cnssEmployer" | "iuts" | "net" | "advance" | "toPay" | "employerCost">;

export function payrollTotals(slips: Payslip[]): PayrollTotals {
  const t: PayrollTotals = { gross: 0, cnssEmployee: 0, cnssEmployer: 0, iuts: 0, net: 0, advance: 0, toPay: 0, employerCost: 0 };
  for (const s of slips) for (const k of Object.keys(t) as (keyof PayrollTotals)[]) t[k] += s[k] ?? 0;
  return t;
}

/** Advance repayments already withheld for `employeeId` in validated or paid months before `month`. */
export function repaidBefore(runs: Record<string, PayrollRun>, employeeId: string, month: string) {
  let total = 0;
  for (const [m, run] of Object.entries(runs)) if (m < month) total += run.lines?.[employeeId]?.advance ?? 0;
  return total;
}

/**
 * Where each of an employee's advances stands before `month`, oldest first: repayments
 * already withheld go to the oldest advance first. `due` is this month's instalments.
 */
export function advanceSchedule(advances: Advance[], repaid: number, month: string) {
  let left = repaid;
  let due = 0;
  const rows = [...advances]
    .sort((a, b) => a.firstMonth.localeCompare(b.firstMonth) || a.date.localeCompare(b.date))
    .map((a) => {
      const paid = Math.min(a.amount, left);
      left -= paid;
      const remaining = a.amount - paid;
      const thisMonth = a.firstMonth <= month ? Math.min(a.installment, remaining) : 0;
      due += thisMonth;
      return { advance: a, paid, remaining, thisMonth };
    });
  return { rows, due };
}
