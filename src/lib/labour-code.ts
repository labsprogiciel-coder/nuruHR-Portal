import type { LeaveType } from "./types";

/**
 * Leave rules from the Burkina Faso Labour Code (Loi n° 028-2008/AN du 13 mai 2008).
 * These are statutory minimums; a contract or collective agreement may be more generous,
 * which is why the yearly allowance in Settings can go above 30 days but not below.
 */
export const LABOUR_CODE = {
  country: "Burkina Faso",
  name: "Burkina Faso Labour Code",
  reference: "Loi n° 028-2008/AN",
} as const;

/** Paid leave accrues at 2.5 calendar days per month of actual service… */
export const ANNUAL_DAYS_PER_MONTH = 2.5;
/** …so a full year of service earns 30 calendar days. */
export const STATUTORY_ANNUAL_DAYS = 12 * ANNUAL_DAYS_PER_MONTH;

/** Extra working days after 20, 25 and 30 years with the same employer. */
const SENIORITY_STEPS: [years: number, days: number][] = [
  [30, 6],
  [25, 4],
  [20, 2],
];

/** Absences for family events affecting the employee's household aren't deducted, up to this many working days a year. */
export const FAMILY_EVENT_DAYS = 10;

/** Maternity leave: 14 weeks, starting 8 to 4 weeks before the expected due date. */
export const MATERNITY_WEEKS = 14;
/** It can be extended by 3 weeks for a certified illness caused by the pregnancy or the birth. */
export const MATERNITY_EXTENSION_WEEKS = 3;

/** Women employees or apprentices under 22 get 2 extra days per dependent child. */
export const YOUNG_MOTHER_DAYS_PER_CHILD = 2;

/**
 * How each leave type is counted. Annual and maternity leave run in calendar days (weekends
 * included); everything else counts working days. Public holidays are never counted.
 */
export const COUNTED_IN: Record<LeaveType, "calendar" | "working"> = {
  "Annual leave": "calendar",
  Sick: "working",
  "Family event": "working",
  Maternity: "calendar",
  "Half-day leave": "working",
  Personal: "working",
};

/**
 * Whether a type is taken from the annual allowance. Sick and maternity leave suspend the
 * contract instead; family events are free up to FAMILY_EVENT_DAYS a year (see leave.ts).
 */
export const DEDUCTED: Record<LeaveType, boolean> = {
  "Annual leave": true,
  Sick: false,
  "Family event": false,
  Maternity: false,
  "Half-day leave": true,
  Personal: true,
};

export function seniorityBonusDays(years: number): number {
  return SENIORITY_STEPS.find(([min]) => years >= min)?.[1] ?? 0;
}

/** Whole years of service on `today`. */
export function yearsOfService(startDate: string, today: string): number {
  if (!startDate || startDate > today) return 0;
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - sy - (tm < sm || (tm === sm && td < sd) ? 1 : 0);
}

/**
 * Days the employee is entitled to in `today`'s calendar year: the yearly allowance, pro-rated
 * by full months of service in the year they were hired, plus the seniority bonus.
 */
export function annualEntitlement(yearlyDays: number, startDate: string | undefined, today: string) {
  const year = Number(today.slice(0, 4));
  let base = yearlyDays;
  if (startDate && Number(startDate.slice(0, 4)) === year) {
    const month = Number(startDate.slice(5, 7)) - 1;
    const fullMonths = 12 - month - (Number(startDate.slice(8, 10)) > 1 ? 1 : 0);
    base = Math.round(((yearlyDays * Math.max(0, fullMonths)) / 12) * 2) / 2;
  } else if (startDate && Number(startDate.slice(0, 4)) > year) {
    base = 0;
  }
  const seniority = startDate ? seniorityBonusDays(yearsOfService(startDate, today)) : 0;
  return { base, seniority, total: base + seniority };
}
