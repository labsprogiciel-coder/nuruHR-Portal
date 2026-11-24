"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, daysInMonth, formatLong, isWeekend, monthName, WEEKDAYS_SHORT, dayOfWeek } from "@/lib/dates";
import { LEAVE_COLORS, plural } from "@/lib/leave";
import type { LeaveType, TeamRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { Card, PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { AddLeaveDialog } from "./add-leave-dialog";
import { DeclineDialog, EmployeeAvatar, TeamRequestDialog, balanceNote, dateRange, useTeam } from "./shared";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Who is away, for the whole team: one row per employee, one column per day of the month.
 * Approved leave is a solid bar, leave still waiting for a decision is dashed. Weekends and
 * public holidays are shaded. Click a bar for the request, an empty day to add leave there.
 */
export function AbsencesPage() {
  const { today, employees, byId, stats, requests } = useTeam();
  const holidays = useAppStore((s) => s.holidays);
  const review = useAppStore((s) => s.reviewRequest);
  const [month, setMonth] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ employeeId?: string; from?: string } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const current = month ?? today.slice(0, 7);
  const first = `${current}-01`;
  const count = daysInMonth(first);
  const last = `${current}-${pad(count)}`;
  const days = useMemo(() => Array.from({ length: count }, (_, i) => `${current}-${pad(i + 1)}`), [current, count]);
  const holidayByDay = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  // Leave that touches this month, approved or still waiting
  const inMonth = useMemo(
    () => requests.filter((r) => (r.status === "approved" || r.status === "pending") && r.from <= last && r.to >= first),
    [requests, first, last],
  );
  const byEmployee = useMemo(() => {
    const map = new Map<string, TeamRequest[]>();
    for (const r of inMonth) map.set(r.employeeId, [...(map.get(r.employeeId) ?? []), r]);
    return map;
  }, [inMonth]);
  // Current staff, plus anyone who has left but had leave this month
  const rows = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    const former = [...byEmployee.keys()].filter((id) => !ids.has(id) && byId.has(id)).map((id) => byId.get(id)!);
    return [...employees, ...former].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, byEmployee, byId]);
  // Counted on working days only: nobody is "away" on a Sunday or a public holiday
  const awayOn = (day: string) =>
    isWeekend(day) || holidayByDay.has(day) ? 0 : inMonth.filter((r) => r.status === "approved" && r.from <= day && r.to >= day).length;
  const peopleAway = new Set(inMonth.filter((r) => r.status === "approved").map((r) => r.employeeId)).size;
  const waiting = inMonth.filter((r) => r.status === "pending").length;
  const types = [...new Set(inMonth.map((r) => r.type))] as LeaveType[];

  const viewing = requests.find((r) => r.id === viewingId);
  const declining = requests.find((r) => r.id === decliningId);
  const label = `${monthName(first)} ${current.slice(0, 4)}`;
  const step = (n: number) => setMonth(addMonths(first, n).slice(0, 7));
  const columns = { gridTemplateColumns: `var(--name-w) repeat(${count}, minmax(30px, 1fr))` };

  return (
    <PageRoot>
      <PageHeader
        title={`Absences · ${label}`}
        description={
          inMonth.length
            ? `${plural(peopleAway, "person", "people")} away this month${waiting ? ` · ${plural(waiting, "request", "requests")} waiting` : ""}`
            : "Nobody has leave this month"
        }
        actions={
          <>
            <Button size="icon" aria-label="Previous month" onClick={() => step(-1)}>
              <ArrowLeftIcon />
            </Button>
            <Button size="icon" aria-label="Next month" onClick={() => step(1)}>
              <ArrowRightIcon />
            </Button>
            <Button onClick={() => setMonth(null)} disabled={current === today.slice(0, 7)}>
              This month
            </Button>
            <Button variant="brand" onClick={() => setAdding({})}>
              <PlusIcon /> Add leave
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        <Card className="overflow-hidden">
          <div className="scroll-thin overflow-x-auto [--name-w:132px] md:[--name-w:208px]">
            <div role="table" aria-label={`Absences in ${label}`} className="min-w-max md:min-w-full">
              {/* Days */}
              <div role="row" className="grid border-b border-hairline bg-app" style={columns}>
                <div role="columnheader" className="t-12 sticky left-0 z-20 flex items-center border-r border-hairline bg-app px-3 py-2 text-fg-2 md:px-4">
                  Employee
                </div>
                {days.map((d) => {
                  const off = isWeekend(d) || holidayByDay.has(d);
                  return (
                    <div
                      key={d}
                      role="columnheader"
                      title={holidayByDay.get(d) ?? formatLong(d)}
                      className={cn("flex flex-col items-center gap-0.5 py-1.5", off && "bg-hover")}
                    >
                      <span className={cn("text-[10px] leading-none tracking-wide", holidayByDay.has(d) ? "text-warning" : "text-placeholder")}>
                        {WEEKDAYS_SHORT[dayOfWeek(d)][0]}
                      </span>
                      <span
                        className={cn(
                          "t-12 flex size-5 items-center justify-center rounded-full tabular-nums",
                          d === today ? "bg-brand font-medium text-on-accent" : off ? "text-fg-2" : "text-fg",
                        )}
                      >
                        {Number(d.slice(8))}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* One row per person */}
              {rows.map((e) => (
                <div key={e.id} role="row" className="grid border-b border-subtle" style={columns}>
                  <div role="rowheader" className="sticky left-0 z-10 flex min-w-0 items-center gap-2.5 border-r border-hairline bg-surface px-3 py-2 md:px-4">
                    <EmployeeAvatar employee={e} className="size-7 rounded-lg text-[11px] max-md:hidden" />
                    <Link href={`/admin/employees/${e.id}`} className="t-14 min-w-0 truncate text-fg hover-fine:underline" title={e.name}>
                      {e.name}
                    </Link>
                  </div>
                  {days.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      tabIndex={-1}
                      aria-label={`Add leave for ${e.name} on ${formatLong(d)}`}
                      onClick={() => setAdding({ employeeId: e.id, from: d })}
                      style={{ gridColumn: i + 2, gridRow: 1 }}
                      className={cn(
                        "h-11 border-r border-subtle outline-none transition-colors duration-150 last:border-r-0 hover-fine:bg-brand-tint focus-visible:bg-brand-tint",
                        (isWeekend(d) || holidayByDay.has(d)) && "bg-hover",
                      )}
                    />
                  ))}
                  {(byEmployee.get(e.id) ?? []).map((r) => {
                    const start = r.from < first ? 1 : Number(r.from.slice(8));
                    const end = r.to > last ? count : Number(r.to.slice(8));
                    const color = LEAVE_COLORS[r.type];
                    const pending = r.status === "pending";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setViewingId(r.id)}
                        title={`${r.type} · ${dateRange(r)}${pending ? " · waiting for a decision" : ""}`}
                        aria-label={`${e.name}: ${r.type}, ${dateRange(r)}${pending ? ", waiting for a decision" : ""}`}
                        style={{
                          gridColumn: `${start + 1} / ${end + 2}`,
                          gridRow: 1,
                          background: pending ? "transparent" : `var(--event-${color}-bg)`,
                          color: `var(--event-${color}-fg)`,
                          borderColor: `var(--event-${color}-fg)`,
                        }}
                        className={cn(
                          "t-12 z-[1] mx-0.5 my-2 flex min-w-0 items-center overflow-hidden rounded-md px-1.5 text-left font-medium outline-none transition-[filter] duration-150 hover-fine:brightness-95 focus-visible:ring-2 focus-visible:ring-brand/50",
                          pending ? "border border-dashed" : "border border-transparent",
                          r.from < first && "ml-0 rounded-l-none",
                          r.to > last && "mr-0 rounded-r-none",
                        )}
                      >
                        <span className="truncate">{end - start >= 2 ? r.type : ""}</span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* How many are away each day */}
              <div role="row" className="grid bg-app" style={columns}>
                <div role="rowheader" className="t-12 sticky left-0 z-10 flex items-center border-r border-hairline bg-app px-3 py-2 text-fg-2 md:px-4">
                  Away
                </div>
                {days.map((d) => {
                  const n = awayOn(d);
                  return (
                    <div
                      key={d}
                      role="cell"
                      className={cn(
                        "t-12 flex items-center justify-center py-2 tabular-nums",
                        n ? "font-medium text-fg" : "text-placeholder",
                        (isWeekend(d) || holidayByDay.has(d)) && "bg-hover",
                      )}
                    >
                      {n || "·"}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <ul className="t-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-fg-2">
          {types.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: `var(--event-${LEAVE_COLORS[t]}-fg)` }} /> {t}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] border border-dashed border-fg-2" /> Waiting for a decision
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px] bg-hover ring-1 ring-hairline" /> Weekend or public holiday
          </li>
        </ul>
      </div>

      <AddLeaveDialog
        open={!!adding}
        employee={adding?.employeeId ? byId.get(adding.employeeId) : undefined}
        employees={employees}
        requests={requests}
        stats={stats}
        today={today}
        from={adding?.from}
        onClose={() => setAdding(null)}
      />
      {viewing ? (
        <TeamRequestDialog
          open
          request={viewing}
          employee={byId.get(viewing.employeeId)}
          balance={viewing.status === "pending" ? balanceNote(viewing, stats.get(viewing.employeeId)) : null}
          onClose={() => setViewingId(null)}
          onApprove={() => review(viewing.id, "approved")}
          onDecline={() => setDecliningId(viewing.id)}
        />
      ) : null}
      {declining ? (
        <DeclineDialog
          open
          who={byId.get(declining.employeeId)?.name}
          what={`${declining.type} · ${dateRange(declining)} · ${declining.duration}`}
          onClose={() => setDecliningId(null)}
          onDecline={(reason) => review(declining.id, "declined", reason)}
        />
      ) : null}
    </PageRoot>
  );
}
