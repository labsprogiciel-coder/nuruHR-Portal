import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import { allRequests, employeeLeaveStats, employees, hrAlerts, isOff, ME } from "./team";

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
