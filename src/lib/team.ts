import { addDays, daysInMonth, diffDays } from "./dates";
import { yearsOfService } from "./labour-code";
import { computeLeaveStats, type LeaveStats } from "./leave";
import { computePayslip } from "./payroll";
import type { AppState, Employee, PayrollRun, TeamRequest } from "./types";

/** The signed-in user's employee id: their profile and own requests stand in for this record. */
export const ME = "emp-me";

type TeamState = Pick<AppState, "team" | "teamRequests" | "requests" | "profile" | "settings" | "holidays">;

/** The team with the signed-in user's identity taken from their profile. */
export function employees(s: Pick<TeamState, "team" | "profile">): Employee[] {
  return s.team.map((e) =>
    e.id === ME
      ? {
          ...e,
          name: s.profile.name,
          initials: s.profile.initials,
          email: s.profile.email,
          phone: s.profile.phone,
          jobTitle: s.profile.jobTitle,
          department: s.profile.department,
          manager: s.profile.manager,
          location: s.profile.location,
          startDate: s.profile.startDate,
        }
      : e,
  );
}

/** Still on the payroll today: no departure, or a last day that hasn't passed yet. */
export function isCurrent(e: Pick<Employee, "departure">, today: string) {
  return !e.departure || e.departure.date >= today;
}

/**
 * Worked at least part of `month` ("YYYY-MM"): started by its end and hadn't left or reached
 * the end of the contract before it began. With both dates set, the earlier one counts.
 */
export function employedIn(e: Pick<Employee, "startDate" | "contractEnd" | "departure">, month: string) {
  const ends = [e.departure?.date, e.contractEnd].filter((d): d is string => !!d).sort();
  const end = ends[0];
  return e.startDate.slice(0, 7) <= month && (!end || end.slice(0, 7) >= month);
}

/**
 * The part of `month` ("YYYY-MM") someone was employed, in calendar days: 1 for a full month,
 * 6/30 for someone who started on 25 November, 0 if they weren't employed at all. Payroll
 * pro-rates base salary and allowances by it.
 */
export function monthShare(e: Pick<Employee, "startDate" | "contractEnd" | "departure">, month: string) {
  if (!employedIn(e, month)) return 0;
  const total = daysInMonth(`${month}-01`);
  const end = [e.departure?.date, e.contractEnd].filter((d): d is string => !!d).sort()[0];
  const first = e.startDate.slice(0, 7) === month ? Number(e.startDate.slice(8, 10)) : 1;
  const last = end && end.slice(0, 7) === month ? Number(end.slice(8, 10)) : total;
  return Math.max(0, last - first + 1) / total;
}

/**
 * Gives closed months that have no saved payslips a frozen set, worked out from the team as it
 * is now. Without them a closed month's payslips would be recalculated on every view and change
 * with each later raise.
 */
export function freezeRuns(runs: Record<string, PayrollRun>, team: Employee[]): Record<string, PayrollRun> {
  return Object.fromEntries(
    Object.entries(runs).map(([month, run]) => [
      month,
      run.lines
        ? run
        : {
            ...run,
            lines: Object.fromEntries(
              team.filter((e) => employedIn(e, month)).map((e) => [e.id, computePayslip(e, {}, 0, monthShare(e, month))]),
            ),
          },
    ]),
  );
}

/** "AO" for "Amina Ouédraogo": first letters of the first two words. */
export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Every leave request in the company: the user's own (as ME) and their colleagues'. */
export function allRequests(s: Pick<TeamState, "requests" | "teamRequests">): TeamRequest[] {
  return [...s.requests.map((r) => ({ ...r, employeeId: ME })), ...s.teamRequests];
}

/**
 * An employee's leave balance under the Labour Code. Everyone shares the company's yearly
 * allowance (Settings); carryover is per person, and the user's own comes from Settings.
 */
export function employeeLeaveStats(e: Employee, s: TeamState, today: string): LeaveStats {
  const own = e.id === ME;
  return computeLeaveStats(
    {
      requests: own ? s.requests : s.teamRequests.filter((r) => r.employeeId === e.id),
      settings: own ? s.settings : { ...s.settings, carryoverDays: e.carryoverDays },
      holidays: s.holidays,
      profile: { startDate: e.startDate },
    },
    today,
  );
}

/** Approved leave covering `day`. */
export function isOff(requests: TeamRequest[], employeeId: string, day: string) {
  return requests.some((r) => r.employeeId === employeeId && r.status === "approved" && r.from <= day && r.to >= day);
}

export type HrAlert = {
  id: string;
  employeeId: string;
  date: string;
  kind: "contract-end" | "trial-end" | "anniversary" | "departure";
  label: string;
};

/** Contract ends, trial periods ending and work anniversaries in the next `withinDays`. */
export function hrAlerts(list: Employee[], today: string, withinDays = 60): HrAlert[] {
  const until = addDays(today, withinDays);
  const soon = (d?: string): d is string => !!d && d >= today && d <= until;
  const alerts: HrAlert[] = [];
  for (const e of list) {
    if (soon(e.departure?.date)) {
      alerts.push({ id: `${e.id}-leaving`, employeeId: e.id, date: e.departure.date, kind: "departure", label: `Last day · ${e.departure.reason.toLowerCase()}` });
      continue;
    }
    if (soon(e.contractEnd)) {
      alerts.push({ id: `${e.id}-end`, employeeId: e.id, date: e.contractEnd, kind: "contract-end", label: `${e.contract} ends` });
    }
    if (soon(e.trialEnd)) {
      alerts.push({ id: `${e.id}-trial`, employeeId: e.id, date: e.trialEnd, kind: "trial-end", label: "Trial period ends" });
    }
    const years = yearsOfService(e.startDate, until);
    const anniversary = `${Number(e.startDate.slice(0, 4)) + years}${e.startDate.slice(4)}`;
    if (years > 0 && soon(anniversary)) {
      alerts.push({
        id: `${e.id}-anniversary`,
        employeeId: e.id,
        date: anniversary,
        kind: "anniversary",
        label: `${years} ${years === 1 ? "year" : "years"} at the company`,
      });
    }
  }
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
}

/** "Today", "Tomorrow", "In 12 days". */
export function inDays(today: string, date: string) {
  const n = diffDays(today, date);
  return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
}
