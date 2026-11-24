import { addDays } from "./dates";
import { LEAVE_COLORS } from "./leave";
import type { Employee, EventColor, Holiday, TeamRequest } from "./types";

/** Something on the company calendar: someone's leave, a public holiday, or an HR date. */
export type TeamEvent = {
  id: string;
  kind: "leave" | "holiday" | "hr";
  from: string;
  to: string;
  title: string;
  /** Leave type colour; holidays and HR dates have their own styles */
  color?: EventColor;
  /** Leave still waiting for a decision */
  pending?: boolean;
  employeeId?: string;
  requestId?: string;
};

const KIND_ORDER = { holiday: 0, hr: 1, leave: 2 } as const;

/**
 * Everything that falls between `from` and `to`: approved and pending leave, public holidays,
 * and the dates HR watches (contract and trial ends, last days, work anniversaries).
 */
export function teamEvents(
  s: { requests: TeamRequest[]; employees: Employee[]; holidays: Holiday[] },
  from: string,
  to: string,
): TeamEvent[] {
  const byId = new Map(s.employees.map((e) => [e.id, e]));
  const events: TeamEvent[] = [];

  for (const h of s.holidays) {
    if (h.date >= from && h.date <= to) events.push({ id: `holiday-${h.id}`, kind: "holiday", from: h.date, to: h.date, title: h.name });
  }

  for (const r of s.requests) {
    if ((r.status !== "approved" && r.status !== "pending") || r.from > to || r.to < from) continue;
    const name = byId.get(r.employeeId)?.name ?? "Someone";
    events.push({
      id: `leave-${r.id}`,
      kind: "leave",
      from: r.from,
      to: r.to,
      title: `${name} · ${r.type}`,
      color: LEAVE_COLORS[r.type],
      pending: r.status === "pending",
      employeeId: r.employeeId,
      requestId: r.id,
    });
  }

  const inRange = (d?: string): d is string => !!d && d >= from && d <= to;
  for (const e of s.employees) {
    const hr = (suffix: string, date: string, title: string) =>
      events.push({ id: `hr-${e.id}-${suffix}`, kind: "hr", from: date, to: date, title: `${e.name} · ${title}`, employeeId: e.id });
    if (inRange(e.departure?.date)) hr("leaving", e.departure.date, "last day");
    // A recorded departure replaces the contract's own end date
    else if (inRange(e.contractEnd)) hr("end", e.contractEnd, `${e.contract} ends`);
    if (inRange(e.trialEnd)) hr("trial", e.trialEnd, "trial period ends");
    const ended = [e.departure?.date, e.contractEnd].filter((d): d is string => !!d).sort()[0];
    for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
      const years = year - Number(e.startDate.slice(0, 4));
      const date = `${year}${e.startDate.slice(4)}`;
      if (years > 0 && inRange(date) && (!ended || date <= ended)) hr(`anniversary-${year}`, date, `${years} ${years === 1 ? "year" : "years"} at the company`);
    }
  }

  return events.sort((a, b) => a.from.localeCompare(b.from) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
}

/** The events of each day between `from` and `to`; a multi-day leave appears under every day it covers. */
export function eventsByDay(events: TeamEvent[], from: string, to: string): Map<string, TeamEvent[]> {
  const map = new Map<string, TeamEvent[]>();
  for (const ev of events) {
    for (let day = ev.from < from ? from : ev.from; day <= ev.to && day <= to; day = addDays(day, 1)) {
      const list = map.get(day);
      if (list) list.push(ev);
      else map.set(day, [ev]);
    }
  }
  for (const list of map.values()) list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
  return map;
}
