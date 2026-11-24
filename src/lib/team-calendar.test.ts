import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { allRequests, employees } from "./team";
import { eventsByDay, teamEvents } from "./team-calendar";

describe("team calendar", () => {
  const seed = createSeed();
  const state = { requests: allRequests(seed), employees: employees(seed), holidays: seed.holidays };

  it("gathers leave, holidays and HR dates in a range", () => {
    const events = teamEvents(state, "2026-12-01", "2026-12-31");
    expect(events.some((e) => e.kind === "holiday" && e.from === "2026-12-25")).toBe(true);
    // Mariam's leave runs Dec 21 – Jan 3 and is approved
    const mariam = events.find((e) => e.kind === "leave" && e.employeeId === "emp-mariam")!;
    expect(mariam).toMatchObject({ from: "2026-12-21", to: "2027-01-03", pending: false, title: "Mariam Traoré · Annual leave" });
    // Ousmane's fixed-term contract ends on Dec 31
    expect(events.some((e) => e.kind === "hr" && e.employeeId === "emp-ousmane" && e.title.includes("CDD ends"))).toBe(true);
    // Declined and cancelled leave stays off the calendar
    expect(teamEvents(state, "2026-09-14", "2026-09-14").some((e) => e.kind === "leave" && e.employeeId === "emp-yacouba")).toBe(false);
    expect(events.every((e) => e.from <= "2026-12-31" && e.to >= "2026-12-01")).toBe(true);
  });

  it("marks work anniversaries, but not in the hiring year or after someone has left", () => {
    const year = teamEvents(state, "2026-01-01", "2026-12-31").filter((e) => e.id.includes("anniversary"));
    expect(year.find((e) => e.employeeId === "emp-me")).toMatchObject({ from: "2026-09-01", title: expect.stringContaining("3 years") });
    // Rasmata joined in September 2026: no anniversary that year
    expect(year.some((e) => e.employeeId === "emp-rasmata")).toBe(false);
    const gone = { ...state, employees: state.employees.map((e) => (e.id === "emp-me" ? { ...e, departure: { date: "2026-06-30", reason: "Resignation" as const, recordedAt: "" } } : e)) };
    expect(teamEvents(gone, "2026-01-01", "2026-12-31").some((e) => e.id === "hr-emp-me-anniversary-2026")).toBe(false);
  });

  it("lists a multi-day leave under every day it covers, within the range", () => {
    const events = teamEvents(state, "2026-12-28", "2027-01-10");
    const days = eventsByDay(events, "2026-12-28", "2027-01-10");
    for (const d of ["2026-12-28", "2026-12-31", "2027-01-03"]) expect(days.get(d)!.some((e) => e.employeeId === "emp-mariam")).toBe(true);
    expect(days.get("2027-01-04")?.some((e) => e.employeeId === "emp-mariam") ?? false).toBe(false);
    // Holidays come first within a day
    expect(days.get("2027-01-01")![0].kind).toBe("holiday");
    expect([...days.keys()].every((d) => d >= "2026-12-28" && d <= "2027-01-10")).toBe(true);
  });
});
