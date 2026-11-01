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
