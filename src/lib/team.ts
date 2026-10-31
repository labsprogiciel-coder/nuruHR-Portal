import { addDays, diffDays } from "./dates";
import { yearsOfService } from "./labour-code";
import { computeLeaveStats, type LeaveStats } from "./leave";
import type { AppState, Employee, TeamRequest } from "./types";

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
  kind: "contract-end" | "trial-end" | "anniversary";
  label: string;
};

/** Contract ends, trial periods ending and work anniversaries in the next `withinDays`. */
export function hrAlerts(list: Employee[], today: string, withinDays = 60): HrAlert[] {
  const until = addDays(today, withinDays);
  const soon = (d?: string): d is string => !!d && d >= today && d <= until;
  const alerts: HrAlert[] = [];
  for (const e of list) {
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
