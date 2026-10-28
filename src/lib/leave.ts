import { isWeekend, rangeKeys } from "./dates";
import { annualEntitlement, COUNTED_IN, DEDUCTED, FAMILY_EVENT_DAYS } from "./labour-code";
import type { AppState, EventColor, Holiday, LeaveRequest, LeaveType, Profile } from "./types";

export const LEAVE_TYPES: LeaveType[] = ["Annual leave", "Sick", "Family event", "Maternity", "Half-day leave", "Personal"];

export const LEAVE_COLORS: Record<LeaveType, EventColor> = {
  "Annual leave": "green",
  Sick: "blue",
  "Family event": "pink",
  Maternity: "purple",
  "Half-day leave": "green",
  Personal: "orange",
};

export const WORKDAY_MINUTES = 8 * 60;

/** Working days between two dates, skipping weekends and public holidays. */
export function workingDays(from: string, to: string, holidays: Holiday[]): string[] {
  const off = new Set(holidays.map((h) => h.date));
  return rangeKeys(from, to).filter((d) => !isWeekend(d) && !off.has(d));
}

/** Days a full-day request counts for: calendar or working days by type, never public holidays. */
export function countedDays(type: LeaveType, from: string, to: string, holidays: Holiday[]): string[] {
  if (COUNTED_IN[type] === "working") return workingDays(from, to, holidays);
  const off = new Set(holidays.map((h) => h.date));
  return rangeKeys(from, to).filter((d) => !off.has(d));
}

/**
 * Days each request takes from the annual allowance. Family events are free until the year's
 * FAMILY_EVENT_DAYS are used up (in date order); anything beyond comes off the allowance.
 */
export function deductedDays(requests: LeaveRequest[]): Map<string, number> {
  const out = new Map<string, number>();
  let family = 0;
  for (const r of [...requests].sort((a, b) => a.from.localeCompare(b.from))) {
    if (r.type === "Family event") {
      const free = Math.max(0, FAMILY_EVENT_DAYS - family);
      family += r.days;
      out.set(r.id, Math.max(0, r.days - free));
    } else {
      out.set(r.id, DEDUCTED[r.type] ? r.days : 0);
    }
  }
  return out;
}

export function durationLabel(days: number, hours: number): string {
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  return parts.join(" ") || "0 hours";
}

export function formatDays(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function plural(n: number, one: string, many: string) {
  return `${formatDays(n)} ${n === 1 ? one : many}`;
}

export type LeaveStats = {
  available: number;
  /** Family-event days still free of deduction this year */
  familyLeft: number;
  /** Seniority bonus included in `contract` */
  seniority: number;
  pendingCount: number;
  pendingDays: number;
  upcoming: number;
  taken: number;
  /** This year's entitlement: yearly allowance (pro-rated in the hiring year) + seniority bonus */
  contract: number;
  carryover: number;
  holidays: number;
};

export function computeLeaveStats(
  s: Pick<AppState, "requests" | "settings" | "holidays"> & { profile?: Pick<Profile, "startDate"> },
  today: string,
): LeaveStats {
  const year = today.slice(0, 4);
  const thisYear = s.requests.filter((r) => r.from.slice(0, 4) === year);
  const counted = thisYear.filter((r) => r.status === "approved" || r.status === "pending");
  const deducted = deductedDays(counted);
  const sum = (list: LeaveRequest[]) => list.reduce((a, r) => a + (deducted.get(r.id) ?? 0), 0);
  const approved = counted.filter((r) => r.status === "approved");
  const pending = counted.filter((r) => r.status === "pending");
  const used = sum(approved);
  const pendingDays = sum(pending);
  const upcoming = sum(approved.filter((r) => r.from >= today));
  const familyUsed = counted.filter((r) => r.type === "Family event").reduce((a, r) => a + r.days, 0);
  const entitlement = annualEntitlement(s.settings.contractDays, s.profile?.startDate, today);
  const total = entitlement.total + s.settings.carryoverDays;
  return {
    available: Math.max(0, total - used - pendingDays),
    familyLeft: Math.max(0, FAMILY_EVENT_DAYS - familyUsed),
    seniority: entitlement.seniority,
    pendingCount: pending.length,
    pendingDays,
    upcoming,
    taken: used - upcoming,
    contract: entitlement.total,
    carryover: s.settings.carryoverDays,
    holidays: s.holidays.filter((h) => h.date.slice(0, 4) === year).length,
  };
}
