import { describe, expect, it } from "vitest";
import { annualEntitlement, seniorityBonusDays, yearsOfService } from "./labour-code";
import { computeLeaveStats, countedDays, deductedDays, durationLabel, formatDays, workingDays } from "./leave";
import { createSeed } from "./seed";
import type { LeaveRequest } from "./types";

const req = (r: Partial<LeaveRequest> & Pick<LeaveRequest, "id" | "type" | "days" | "from">): LeaveRequest => ({
  status: "approved",
  duration: "",
  to: r.from,
  allDay: true,
  notes: "",
  submittedAt: "2026-01-01T00:00:00.000Z",
  ...r,
});

describe("leave rules", () => {
  it("computes the seeded balances under the Burkina Faso Labour Code", () => {
    const seed = createSeed();
    const stats = computeLeaveStats(seed, "2026-10-26");
    // 30 days a year + 4 carried over − 16.5 approved − 1 pending
    expect(stats.contract).toBe(30);
    expect(stats.carryover).toBe(4);
    expect(stats.available).toBe(16.5);
    expect(stats.pendingCount).toBe(2);
    expect(stats.pendingDays).toBe(1);
    expect(stats.upcoming).toBe(3.5);
    expect(stats.familyLeft).toBe(8);
    expect(stats.holidays).toBe(16);
  });

  it("skips weekends and public holidays when counting working days", () => {
    const holidays = [{ id: "h", date: "2026-11-11", name: "Test" }];
    // Mon 9 → Sun 15: five weekdays minus one holiday
    expect(workingDays("2026-11-09", "2026-11-15", holidays)).toHaveLength(4);
  });

  it("counts annual leave in calendar days, minus public holidays", () => {
    const holidays = [{ id: "h", date: "2026-08-05", name: "Independence Day" }];
    expect(countedDays("Annual leave", "2026-08-03", "2026-08-09", holidays)).toHaveLength(6);
    expect(countedDays("Family event", "2026-08-03", "2026-08-09", holidays)).toHaveLength(4);
  });

  it("only deducts family events beyond 10 working days a year", () => {
    const d = deductedDays([
      req({ id: "a", type: "Family event", days: 6, from: "2026-02-01" }),
      req({ id: "b", type: "Family event", days: 6, from: "2026-05-01" }),
      req({ id: "c", type: "Sick", days: 3, from: "2026-06-01" }),
      req({ id: "d", type: "Annual leave", days: 5, from: "2026-07-01" }),
    ]);
    expect([...d.values()]).toEqual([0, 2, 0, 5]);
  });

  it("adds seniority days and pro-rates the hiring year", () => {
    expect(seniorityBonusDays(19)).toBe(0);
    expect(seniorityBonusDays(20)).toBe(2);
    expect(seniorityBonusDays(27)).toBe(4);
    expect(seniorityBonusDays(31)).toBe(6);
    expect(yearsOfService("2006-11-01", "2026-10-31")).toBe(19);
    expect(yearsOfService("2006-11-01", "2026-11-01")).toBe(20);
    expect(annualEntitlement(30, "2006-01-15", "2026-10-26")).toEqual({ base: 30, seniority: 2, total: 32 });
    // Hired Jul 1: six full months → 15 days
    expect(annualEntitlement(30, "2026-07-01", "2026-10-26").total).toBe(15);
    // Hired Jul 10: July isn't a full month → 12.5 days
    expect(annualEntitlement(30, "2026-07-10", "2026-10-26").total).toBe(12.5);
  });

  it("labels durations naturally", () => {
    expect(durationLabel(1, 0)).toBe("1 day");
    expect(durationLabel(2, 4)).toBe("2 days 4 hours");
    expect(durationLabel(0, 1)).toBe("1 hour");
    expect(formatDays(0.75)).toBe("0.75");
    expect(formatDays(7)).toBe("7");
  });
});
