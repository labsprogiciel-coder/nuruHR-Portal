import { describe, expect, it } from "vitest";
import { redo, undo, useAppStore } from "./app-store";

const ev = () => useAppStore.getState().events.find((e) => e.id === "ev-2")!;

describe("undo / redo", () => {
  it("steps back and forward through data changes", () => {
    const before = ev().start;
    useAppStore.getState().moveEvent("ev-2", { date: "2026-11-09", start: 780, end: 840 });
    expect(ev().start).toBe(780);

    expect(undo()).toBe("Calendar");
    expect(ev().start).toBe(before);
    expect(ev().date).toBe("2026-11-08");

    expect(redo()).toBe("Calendar");
    expect(ev().start).toBe(780);
  });

  it("restores a deleted event and labels leave changes", () => {
    useAppStore.getState().deleteEvent("ev-5");
    expect(useAppStore.getState().events.some((e) => e.id === "ev-5")).toBe(false);
    undo();
    expect(useAppStore.getState().events.some((e) => e.id === "ev-5")).toBe(true);

    useAppStore.getState().setRequestStatus("rq-6", "approved");
    expect(undo()).toBe("Leave request");
    expect(useAppStore.getState().requests.find((r) => r.id === "rq-6")!.status).toBe("pending");
  });

  it("does not record notifications", () => {
    while (undo()) {
      /* drain history */
    }
    useAppStore.getState().notify({ title: "t", body: "b" });
    expect(undo()).toBeNull();
  });
});

describe("equipment", () => {
  const asset = (id: string) => useAppStore.getState().assets.find((a) => a.id === id)!;

  it("assigns stock to someone and returns it, with undo", () => {
    expect(asset("as-8").status).toBe("in-stock");
    useAppStore.getState().assignAsset("as-8", "emp-me");
    expect(asset("as-8")).toMatchObject({ employeeId: "emp-me", status: "in-use" });
    expect(asset("as-8").assignedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Assigning to the signed-in user tells them
    expect(useAppStore.getState().notifications[0].title).toBe("New equipment assigned");

    useAppStore.getState().assignAsset("as-8", null);
    expect(asset("as-8")).toMatchObject({ employeeId: null, status: "in-stock", assignedOn: undefined });
    expect(undo()).toBe("Equipment");
    expect(asset("as-8").employeeId).toBe("emp-me");
  });

  it("tracks a reported problem through repair and back to stock", () => {
    useAppStore.getState().reportAssetIssue("as-2", "Screen flickers");
    expect(asset("as-2").issue?.note).toBe("Screen flickers");

    useAppStore.getState().sendAssetToRepair("as-2");
    expect(asset("as-2")).toMatchObject({ status: "in-repair", employeeId: null });

    useAppStore.getState().resolveAssetIssue("as-2");
    expect(asset("as-2")).toMatchObject({ status: "in-stock", condition: "Good", issue: undefined });
  });
});

describe("guards", () => {
  const state = () => useAppStore.getState();

  it("refuses leave that overlaps an existing request", () => {
    const first = state().submitRequest({ type: "Annual leave", from: "2027-03-01", to: "2027-03-05", allDay: true, start: 0, end: 0, notes: "" });
    expect(first).not.toBeNull();
    const count = state().requests.length;
    expect(state().submitRequest({ type: "Annual leave", from: "2027-03-05", to: "2027-03-08", allDay: true, start: 0, end: 0, notes: "" })).toBeNull();
    expect(state().requests.length).toBe(count);
    // Editing the same request is fine
    expect(state().submitRequest({ type: "Annual leave", from: "2027-03-02", to: "2027-03-05", allDay: true, start: 0, end: 0, notes: "" }, first!.id)).not.toBeNull();
  });

  it("validates payroll months in order and keeps repaid advances", () => {
    // September and October are closed in the demo, so November is next
    state().validatePayroll("2026-12", {});
    expect(state().payrollRuns["2026-12"]).toBeUndefined();
    const adv = state().advances.find((a) => a.employeeId === "emp-rasmata")!;
    const slip = { ...state().payrollRuns["2026-10"].lines!["emp-rasmata"], advance: adv.installment };
    state().validatePayroll("2026-11", { "emp-rasmata": slip });
    expect(state().payrollRuns["2026-11"].status).toBe("validated");
    // A repayment was withheld, so the advance stays
    state().removeAdvance(adv.id);
    expect(state().advances.some((a) => a.id === adv.id)).toBe(true);
    // Only the latest month reopens
    state().reopenPayroll("2026-10");
    expect(state().payrollRuns["2026-10"]).toBeDefined();
    state().reopenPayroll("2026-11");
    expect(state().payrollRuns["2026-11"]).toBeUndefined();
    state().removeAdvance(adv.id);
    expect(state().advances.some((a) => a.id === adv.id)).toBe(false);
  });

  it("keeps the reason with a declined request and drops it when the decision changes", () => {
    const pending = state().teamRequests.find((r) => r.status === "pending")!;
    state().reviewRequest(pending.id, "declined", "  Two people are already away  ");
    const declined = state().teamRequests.find((r) => r.id === pending.id)!;
    expect(declined.status).toBe("declined");
    expect(declined.declineReason).toBe("Two people are already away");
    state().reviewRequest(pending.id, "approved");
    expect(state().teamRequests.find((r) => r.id === pending.id)!.declineReason).toBeUndefined();
    // The signed-in user's own request: the reason reaches their notification
    state().reviewRequest("rq-6", "declined", "Project deadline");
    expect(state().requests.find((r) => r.id === "rq-6")!.declineReason).toBe("Project deadline");
    expect(state().notifications[0].body).toContain("Reason: Project deadline");
  });
});
