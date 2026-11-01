import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { allRequests, employedIn, employeeLeaveStats, employees, hrAlerts, initialsOf, isCurrent, isOff, ME } from "./team";
import type { Employee } from "./types";

const TODAY = "2026-10-31";

describe("team helpers", () => {
  const seed = createSeed();
  const team = employees(seed);
  const byId = new Map(team.map((e) => [e.id, e]));

  it("takes the signed-in user's identity from their profile", () => {
    const me = byId.get(ME)!;
    expect(me.name).toBe(seed.profile.name);
    expect(me.contract).toBe("CDI");
    expect(allRequests(seed).filter((r) => r.employeeId === ME)).toHaveLength(seed.requests.length);
  });

  it("matches the employee's own balance for the signed-in user", () => {
    expect(employeeLeaveStats(byId.get(ME)!, seed, TODAY).available).toBe(16.5);
  });

  it("adds the seniority bonus and pro-rates the hiring year", () => {
    // Issouf: 22 years → 30 + 2; 10 days approved this year, 2 free family days, 6 carried over
    const issouf = employeeLeaveStats(byId.get("emp-issouf")!, seed, TODAY);
    expect(issouf.contract).toBe(32);
    expect(issouf.available).toBe(32 + 6 - 10);
    // Rasmata: hired Sep 1 → four full months → 10 days
    expect(employeeLeaveStats(byId.get("emp-rasmata")!, seed, TODAY).contract).toBe(10);
  });

  it("knows who is away", () => {
    const requests = allRequests(seed);
    expect(isOff(requests, "emp-issouf", TODAY)).toBe(true);
    expect(isOff(requests, "emp-salimata", TODAY)).toBe(false);
  });

  it("lists contract ends, trial ends and anniversaries in date order", () => {
    const alerts = hrAlerts(team, TODAY);
    expect(alerts.map((a) => `${a.employeeId}:${a.kind}`)).toEqual([
      "emp-ousmane:anniversary",
      "emp-rasmata:trial-end",
      "emp-yacouba:contract-end",
    ]);
    // Ousmane's CDD ends Dec 31: 61 days out, just past the default window
    expect(hrAlerts(team, TODAY, 61).at(-1)?.id).toBe("emp-ousmane-end");
  });
});

const base: Employee = {
  id: "e1",
  name: "Aminata Ouédraogo",
  initials: "AO",
  email: "a@x.bf",
  phone: "",
  jobTitle: "Accountant",
  department: "Finance",
  manager: "",
  location: "Ouagadougou",
  startDate: "2025-03-10",
  contract: "CDI",
  monthlySalary: 300_000,
  cnssNumber: "",
  dependents: 0,
  carryoverDays: 0,
};

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("aminata ouédraogo kaboré")).toBe("AO");
    expect(initialsOf("  Issouf  ")).toBe("I");
    expect(initialsOf("")).toBe("?");
  });
});

describe("isCurrent", () => {
  it("keeps people until the end of their last day", () => {
    const leaving = { ...base, departure: { date: "2026-11-15", reason: "Resignation" as const, recordedAt: "" } };
    expect(isCurrent(base, "2026-11-01")).toBe(true);
    expect(isCurrent(leaving, "2026-11-15")).toBe(true);
    expect(isCurrent(leaving, "2026-11-16")).toBe(false);
  });
});

describe("employedIn", () => {
  it("covers the months from the start to the last day, inclusive", () => {
    const leaving = { ...base, departure: { date: "2026-11-15", reason: "Resignation" as const, recordedAt: "" } };
    expect(employedIn(leaving, "2025-02")).toBe(false);
    expect(employedIn(leaving, "2025-03")).toBe(true);
    expect(employedIn(leaving, "2026-11")).toBe(true);
    expect(employedIn(leaving, "2026-12")).toBe(false);
  });
  it("uses the contract end for fixed-term staff with no departure recorded", () => {
    const cdd = { ...base, contract: "CDD" as const, contractEnd: "2026-06-30" };
    expect(employedIn(cdd, "2026-06")).toBe(true);
    expect(employedIn(cdd, "2026-07")).toBe(false);
  });
  it("stops at the earlier of the departure and the contract end", () => {
    const late = { ...base, contract: "CDD" as const, contractEnd: "2026-06-30", departure: { date: "2026-07-15", reason: "Other" as const, recordedAt: "" } };
    expect(employedIn(late, "2026-07")).toBe(false);
    const early = { ...late, departure: { ...late.departure, date: "2026-04-10" } };
    expect(employedIn(early, "2026-04")).toBe(true);
    expect(employedIn(early, "2026-05")).toBe(false);
  });
});

describe("hrAlerts", () => {
  it("lists an upcoming departure instead of the contract end", () => {
    const e = {
      ...base,
      contract: "CDD" as const,
      contractEnd: "2026-11-30",
      departure: { date: "2026-11-20", reason: "Resignation" as const, recordedAt: "" },
    };
    const alerts = hrAlerts([e], "2026-11-01");
    expect(alerts.map((a) => a.kind)).toEqual(["departure"]);
    expect(alerts[0].label).toBe("Last day · resignation");
  });
});
