"use client";

import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseIcon, FlagIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addDays,
  addMonths,
  dayOfWeek,
  daysInMonth,
  formatLong,
  formatShort,
  formatTimeRange,
  monthGrid,
  monthName,
  startOfWeek,
  WEEKDAYS_SHORT,
} from "@/lib/dates";
import { plural } from "@/lib/leave";
import { eventsByDay, teamEvents, type TeamEvent } from "@/lib/team-calendar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { AddLeaveDialog } from "./add-leave-dialog";
import { DeclineDialog, TeamRequestDialog, balanceNote, dateRange, useTeam } from "./shared";

type View = "week" | "month" | "year";
const VIEWS: { value: View; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];
const pad = (n: number) => String(n).padStart(2, "0");
const sameYear = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);

/** How an event is drawn everywhere: leave in its type's colour (dashed while pending), holidays and HR dates in their own. */
function chipStyle(ev: TeamEvent): { className: string; style?: React.CSSProperties } {
  if (ev.kind === "holiday") return { className: "border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] text-[var(--status-warning)]" };
  if (ev.kind === "hr") return { className: "border border-hairline bg-app text-fg-2" };
  return {
    className: ev.pending ? "border border-dashed" : "border border-transparent",
    style: {
      background: ev.pending ? "transparent" : `var(--event-${ev.color}-bg)`,
      color: `var(--event-${ev.color}-fg)`,
      borderColor: ev.pending ? `var(--event-${ev.color}-fg)` : undefined,
    },
  };
}

function EventChip({ ev, onOpen, className }: { ev: TeamEvent; onOpen: (ev: TeamEvent) => void; className?: string }) {
  const { className: tone, style } = chipStyle(ev);
  const label = `${ev.title}${ev.pending ? " · waiting for a decision" : ""}`;
  const inner = (
    <>
      {ev.kind === "holiday" ? <FlagIcon className="size-3 shrink-0" /> : ev.kind === "hr" ? <BriefcaseIcon className="size-3 shrink-0" /> : null}
      <span className="truncate">{ev.title}</span>
    </>
  );
  const shared = cn("t-12 flex h-[22px] min-w-0 items-center gap-1 rounded-md px-1.5 text-left font-medium", tone, className);
  return ev.kind === "leave" ? (
    <button
      type="button"
      title={label}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(ev);
      }}
      className={cn(shared, "outline-none transition-[filter] duration-150 hover-fine:brightness-95 focus-visible:ring-2 focus-visible:ring-brand/50")}
    >
      {inner}
    </button>
  ) : (
    <span title={label} style={style} className={shared}>
      {inner}
    </span>
  );
}

/**
 * The company calendar: everyone's leave, public holidays and the dates HR watches, as the
 * week, a month grid or a whole year. A day opens its events; leave opens the request.
 */
export function TeamCalendarPage() {
  const { today, employees, everyone, byId, stats, requests } = useTeam();
  const holidays = useAppStore((s) => s.holidays);
  const weekStartsOn = useAppStore((s) => s.settings.weekStartsOn);
  const review = useAppStore((s) => s.reviewRequest);
  const [view, setView] = useState<View>("month");
  const [anchorDate, setAnchor] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ from?: string } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const anchor = anchorDate ?? today;
  const year = anchor.slice(0, 4);
  const timeFormat = useAppStore((s) => s.settings.timeFormat);
  // What's on screen: the anchor's week, the month's six-week grid, or the whole year
  const grid = useMemo(() => monthGrid(anchor, weekStartsOn), [anchor, weekStartsOn]);
  const weekStart = startOfWeek(anchor, weekStartsOn);
  const [from, to] =
    view === "week" ? [weekStart, addDays(weekStart, 6)] : view === "month" ? [grid[0], grid[41]] : [`${year}-01-01`, `${year}-12-31`];
  const events = useMemo(() => teamEvents({ requests, employees: everyone, holidays }, from, to), [requests, everyone, holidays, from, to]);
  const byDay = useMemo(() => eventsByDay(events, from, to), [events, from, to]);

  const label =
    view === "year"
      ? year
      : view === "month"
        ? `${monthName(anchor)} ${year}`
        : `${formatShort(from)}${sameYear(from, to) ? "" : `, ${from.slice(0, 4)}`} – ${formatShort(to)}, ${to.slice(0, 4)}`;
  const step = (n: number) => setAnchor(view === "week" ? addDays(anchor, 7 * n) : addMonths(anchor.slice(0, 8) + "01", view === "month" ? n : 12 * n));
  const leaveCount = events.filter((e) => e.kind === "leave").length;
  const holidayCount = events.filter((e) => e.kind === "holiday").length;

  const openEvent = (ev: TeamEvent) => ev.requestId && setViewingId(ev.requestId);
  const viewing = requests.find((r) => r.id === viewingId);
  const declining = requests.find((r) => r.id === decliningId);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => WEEKDAYS_SHORT[(weekStartsOn + i) % 7]), [weekStartsOn]);

  return (
    <PageRoot className="bg-surface">
      <PageHeader
        title={`Calendar · ${label}`}
        description={`${plural(leaveCount, "leave", "leaves")} · ${plural(holidayCount, "public holiday", "public holidays")}`}
        actions={
          <>
            <Button onClick={() => setAnchor(null)} disabled={anchor === today}>
              Today
            </Button>
            <Button size="icon" aria-label={`Previous ${view}`} onClick={() => step(-1)}>
              <ArrowLeftIcon />
            </Button>
            <Button size="icon" aria-label={`Next ${view}`} onClick={() => step(1)}>
              <ArrowRightIcon />
            </Button>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList className="h-9" aria-label="Calendar view">
                {VIEWS.map((v) => (
                  <TabsTrigger key={v.value} value={v.value} className="t-14 salt h-8 px-2.5 text-[14px] data-active:text-fg">
                    {v.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="brand" onClick={() => setAdding({})}>
              <PlusIcon /> Add leave
            </Button>
          </>
        }
      />

      {view === "month" ? (
        <div className="flex min-h-[560px] flex-1 flex-col">
          <div className="grid shrink-0 grid-cols-7 border-b border-hairline bg-app">
            {weekdays.map((w) => (
              <div key={w} className="px-2 py-1.5 text-center text-[11px] leading-none tracking-wide text-fg-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-6">
            {grid.map((d) => {
              const list = byDay.get(d) ?? [];
              const outside = d.slice(0, 7) !== anchor.slice(0, 7);
              const weekend = dayOfWeek(d) === 0 || dayOfWeek(d) === 6;
              return (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  aria-label={`${formatLong(d)}, ${list.length ? plural(list.length, "event", "events") : "no events"}`}
                  onClick={() => setOpenDay(d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenDay(d);
                    }
                  }}
                  className={cn(
                    "flex min-h-0 min-w-0 cursor-pointer flex-col gap-1 border-r border-b border-subtle p-1 outline-none transition-colors duration-150 hover-fine:bg-hover focus-visible:bg-hover md:p-1.5 [&:nth-child(7n)]:border-r-0",
                    (outside || weekend) && "bg-app/60",
                  )}
                >
                  <span
                    className={cn(
                      "t-12 flex size-6 shrink-0 items-center justify-center self-center rounded-full tabular-nums md:self-start",
                      d === today ? "bg-brand font-medium text-on-accent" : outside ? "text-placeholder" : "text-fg",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* Desktop: the first events by name. Phones: one dot each. */}
                  <div className="flex min-h-0 flex-col gap-0.5 max-md:hidden">
                    {list.slice(0, 3).map((ev) => (
                      <EventChip key={ev.id} ev={ev} onOpen={openEvent} />
                    ))}
                    {list.length > 3 ? <span className="t-12 px-1.5 text-fg-2">+{list.length - 3} more</span> : null}
                  </div>
                  <div className="flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden>
                    {list.slice(0, 4).map((ev) => (
                      <span
                        key={ev.id}
                        className={cn("size-1.5 rounded-full", ev.kind === "holiday" ? "bg-warning" : ev.kind === "hr" ? "bg-fg-2" : "")}
                        style={ev.kind === "leave" ? { background: `var(--event-${ev.color}-fg)`, opacity: ev.pending ? 0.45 : 1 } : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "week" ? (
        // Desktop: seven columns side by side. Phones: the same days stacked as rows.
        <div className="grid flex-1 md:min-h-[480px] md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const list = byDay.get(d) ?? [];
            const weekend = dayOfWeek(d) === 0 || dayOfWeek(d) === 6;
            return (
              <section
                key={d}
                aria-label={formatLong(d)}
                className={cn(
                  "flex min-w-0 gap-3 border-b border-subtle px-4 py-3 md:flex-col md:gap-2 md:border-r md:border-b-0 md:px-1.5 md:py-0 md:last:border-r-0",
                  weekend && "bg-app/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenDay(d)}
                  aria-label={`${formatLong(d)}, ${list.length ? plural(list.length, "event", "events") : "no events"}`}
                  className="flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg py-0.5 outline-none hover-fine:bg-hover focus-visible:bg-hover md:w-full md:border-b md:border-hairline md:py-2"
                >
                  <span className="text-[11px] leading-none tracking-wide text-fg-2">{WEEKDAYS_SHORT[dayOfWeek(d)]}</span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-[16px] tabular-nums",
                      d === today ? "bg-brand font-medium text-on-accent" : "text-fg",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1 max-md:pt-1 md:pb-2">
                  {list.length ? (
                    list.map((ev) => (
                      <div key={ev.id} className="grid min-w-0 gap-0.5">
                        <EventChip ev={ev} onOpen={openEvent} className="h-7 max-w-full px-2 max-md:w-fit" />
                        {ev.start !== undefined && ev.end !== undefined ? (
                          <span className="t-12 px-2 text-fg-2 tabular-nums">{formatTimeRange(ev.start, ev.end, timeFormat)}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="t-12 py-1.5 text-placeholder md:px-2">Nothing</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-7 p-4 sm:grid-cols-2 md:p-5 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => `${year}-${pad(m + 1)}-01`).map((first) => {
            const lead = (dayOfWeek(first) - weekStartsOn + 7) % 7;
            const count = daysInMonth(first);
            return (
              <section key={first} aria-label={`${monthName(first)} ${year}`} className="grid content-start gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAnchor(first);
                    setView("month");
                  }}
                  className="t-14 w-fit rounded font-medium text-fg outline-none hover-fine:text-brand focus-visible:underline"
                >
                  {monthName(first)}
                </button>
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {weekdays.map((w) => (
                    <span key={w} className="pb-1 text-[10px] leading-none text-placeholder">
                      {w[0]}
                    </span>
                  ))}
                  {Array.from({ length: lead }, (_, i) => (
                    <span key={`lead-${i}`} />
                  ))}
                  {Array.from({ length: count }, (_, i) => `${first.slice(0, 8)}${pad(i + 1)}`).map((d) => {
                    const list = byDay.get(d) ?? [];
                    const holiday = list.some((e) => e.kind === "holiday");
                    const away = list.filter((e) => e.kind === "leave" && !e.pending).length;
                    const other = list.length > 0 && !holiday && !away;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setOpenDay(d)}
                        title={list.length ? list.map((e) => e.title).join("\n") : undefined}
                        aria-label={`${formatLong(d)}${list.length ? `, ${plural(list.length, "event", "events")}` : ""}`}
                        className={cn(
                          "t-12 relative mx-auto flex size-7 items-center justify-center rounded-full tabular-nums outline-none transition-colors duration-150 hover-fine:bg-hover focus-visible:ring-2 focus-visible:ring-brand/50",
                          d === today
                            ? "bg-brand font-medium text-on-accent hover-fine:bg-brand"
                            : away
                              ? "bg-brand-tint font-medium text-brand"
                              : holiday
                                ? "bg-[var(--status-warning-tint)] font-medium text-[var(--status-warning)]"
                                : "text-fg",
                        )}
                      >
                        {Number(d.slice(8))}
                        {other || (d === today && list.length) ? <span className="absolute bottom-0.5 size-1 rounded-full bg-fg-2" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ul className="t-12 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-4 py-3 text-fg-2">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] bg-brand-tint ring-1 ring-brand/30" /> Approved leave
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] border border-dashed border-fg-2" /> Waiting for a decision
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] bg-[var(--status-warning-tint)] ring-1 ring-[var(--status-warning-border)]" /> Public holiday
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[3px] bg-app ring-1 ring-hairline" /> Contract, trial and anniversary dates
        </li>
      </ul>

      <DayDialog
        day={openDay}
        events={openDay ? (byDay.get(openDay) ?? []) : []}
        onOpen={(ev) => {
          setOpenDay(null);
          openEvent(ev);
        }}
        onAdd={() => {
          setAdding({ from: openDay ?? undefined });
          setOpenDay(null);
        }}
        onClose={() => setOpenDay(null)}
      />
      <AddLeaveDialog
        open={!!adding}
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

/** Everything on one day, with a way to add leave starting then. */
function DayDialog({
  day,
  events,
  onOpen,
  onAdd,
  onClose,
}: {
  day: string | null;
  events: TeamEvent[];
  onOpen: (ev: TeamEvent) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!day} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-5 sm:max-w-[420px]">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="t-16">{day ? formatLong(day) : ""}</DialogTitle>
          <DialogDescription className="t-14">
            {events.length ? plural(events.length, "event", "events") : "Nothing on this day"}
            {day ? ` · ${WEEKDAYS_SHORT[dayOfWeek(day)].charAt(0)}${WEEKDAYS_SHORT[dayOfWeek(day)].slice(1).toLowerCase()}` : ""}
          </DialogDescription>
        </DialogHeader>
        {events.length ? (
          <ul className="grid gap-1.5">
            {events.map((ev) => (
              <li key={ev.id} className="flex min-w-0">
                <EventChip ev={ev} onOpen={onOpen} className="h-8 w-full px-2.5" />
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="brand" onClick={onAdd}>
            <PlusIcon /> Add leave from this day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
