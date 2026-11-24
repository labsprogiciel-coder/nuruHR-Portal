"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SearchXIcon, XIcon } from "lucide-react";
import { Icon } from "@/components/icon";
import { FilterMenu, type FilterGroup } from "@/components/filter-menu";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/time-off/status-badge";
import { formatLong } from "@/lib/dates";
import { LEAVE_COLORS, LEAVE_TYPES, plural } from "@/lib/leave";
import type { LeaveStatus, LeaveType, TeamRequest } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { ALL_STATUSES } from "@/stores/request-filters-store";
import { PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { AddLeaveDialog } from "./add-leave-dialog";
import { DeclineDialog, TeamRequestDialog, balanceNote, dateRange, useTeam } from "./shared";

type SortKey = "employee" | "status" | "type" | "days" | "from" | "to";
type Sort = { key: SortKey; dir: 1 | -1 } | null;

const COLUMNS: { key: SortKey | "notes"; label: string; width?: number }[] = [
  { key: "employee", label: "Employee", width: 184 },
  { key: "status", label: "Status", width: 112 },
  { key: "type", label: "Leave type", width: 128 },
  { key: "days", label: "Duration", width: 104 },
  { key: "from", label: "Date from", width: 148 },
  { key: "to", label: "Date to", width: 148 },
  { key: "notes", label: "Notes" },
];

const STATUS_LABEL: Record<LeaveStatus, string> = { approved: "Approved", pending: "Pending", declined: "Declined", cancelled: "Cancelled" };
const STATUS_TONE: Record<LeaveStatus, string> = { approved: "success", pending: "warning", declined: "danger", cancelled: "neutral" };

/**
 * Every leave request in the company as one plain table: who, status, type, duration, dates
 * and note, with search, filters and sortable columns. A row opens the request in full.
 */
export function LeavesPage() {
  const { today, employees, byId, stats, requests } = useTeam();
  const review = useAppStore((s) => s.reviewRequest);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<LeaveStatus[]>(ALL_STATUSES);
  const [types, setTypes] = useState<LeaveType[]>(LEAVE_TYPES);
  const [sort, setSort] = useState<Sort>(null);
  const [adding, setAdding] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const nameOf = (r: TeamRequest) => byId.get(r.employeeId)?.name ?? "";
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const name = (r: TeamRequest) => byId.get(r.employeeId)?.name ?? "";
    const filtered = requests.filter(
      (r) =>
        statuses.includes(r.status) &&
        types.includes(r.type) &&
        (!q || [name(r), r.type, r.status, r.notes, r.duration, formatLong(r.from), formatLong(r.to)].some((v) => v.toLowerCase().includes(q))),
    );
    // Default order: most recently submitted first
    const ordered = [...filtered].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    if (!sort) return ordered;
    const value = (r: TeamRequest) => (sort.key === "employee" ? name(r) : sort.key === "days" ? r.days : String(r[sort.key]));
    return ordered.sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [requests, byId, query, statuses, types, sort]);

  const pending = requests.filter((r) => r.status === "pending").length;
  const activeCount = Number(statuses.length !== ALL_STATUSES.length) + Number(types.length !== LEAVE_TYPES.length);
  const reset = () => {
    setQuery("");
    setStatuses(ALL_STATUSES);
    setTypes(LEAVE_TYPES);
    setSort(null);
  };
  const groups: FilterGroup[] = [
    {
      id: "status",
      label: "Status",
      type: "multi",
      value: statuses,
      onChange: (v) => setStatuses(v as LeaveStatus[]),
      options: ALL_STATUSES.map((st) => ({
        value: st,
        label: STATUS_LABEL[st],
        adornment: <span className="size-2 rounded-full" style={{ background: `var(--status-${STATUS_TONE[st]})` }} />,
      })),
    },
    {
      id: "type",
      label: "Leave type",
      type: "multi",
      value: types,
      onChange: (v) => setTypes(v as LeaveType[]),
      options: LEAVE_TYPES.map((t) => ({
        value: t,
        label: t,
        adornment: <span className="size-2 rounded-full" style={{ background: `var(--event-${LEAVE_COLORS[t]}-fg)` }} />,
      })),
    },
  ];
  const toggleSort = (key: SortKey) => setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));

  const viewing = requests.find((r) => r.id === viewingId);
  const declining = requests.find((r) => r.id === decliningId);

  return (
    <PageRoot className="bg-surface">
      <PageHeader
        title="Leaves"
        description={`${plural(requests.length, "request", "requests")} · ${pending ? `${pending} awaiting a decision` : "none awaiting a decision"}`}
        actions={
          <Button variant="brand" onClick={() => setAdding(true)}>
            <PlusIcon /> Add leave
          </Button>
        }
      />

      <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3 md:h-14">
        <p className="t-14 shrink-0 text-fg-2 tabular-nums max-sm:hidden">
          {rows.length === requests.length ? `${requests.length} in total` : `${rows.length} of ${requests.length} shown`}
        </p>
        <div className="flex items-center gap-2 max-sm:w-full">
          <label className="flex h-8 w-60 items-center gap-2 rounded-lg border border-control bg-surface px-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-brand/60 focus-within:ring-3 focus-within:ring-brand/15 max-sm:h-10 max-sm:w-auto max-sm:flex-1">
            <Icon name="search" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search leave"
              className="md:t-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-2 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="press text-icon hover-fine:text-fg">
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </label>
          <FilterMenu title="Filter leave" groups={groups} activeCount={activeCount} onReset={reset} />
        </div>
      </div>

      <div className="scroll-thin w-full min-w-0 overflow-x-auto max-md:border-t max-md:border-hairline">
        <div role="table" aria-rowcount={rows.length} className="w-full min-w-0 md:min-w-[1040px]">
          <div role="row" className="flex h-10 w-full items-center gap-3 border-y border-hairline bg-app px-4 max-md:hidden">
            {COLUMNS.map((c) =>
              c.key === "notes" ? (
                <div key={c.key} role="columnheader" className="t-14 min-w-0 flex-1 px-3 text-fg-2">
                  {c.label}
                </div>
              ) : (
                <button
                  key={c.key}
                  type="button"
                  role="columnheader"
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  onClick={() => toggleSort(c.key as SortKey)}
                  className="t-14 flex h-full shrink-0 items-center gap-1 px-3 text-left text-fg-2 outline-none hover-fine:text-fg focus-visible:text-fg"
                  style={{ width: c.width }}
                >
                  {c.label}
                  {sort?.key === c.key ? sort.dir === 1 ? <ArrowUpIcon className="size-3 text-fg" /> : <ArrowDownIcon className="size-3 text-fg" /> : null}
                </button>
              ),
            )}
          </div>

          {rows.map((r) => (
            <div
              key={r.id}
              role="row"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("a,button")) setViewingId(r.id);
              }}
              className="flex h-14 w-full cursor-pointer items-center gap-3 border-b border-subtle px-4 transition-colors duration-150 hover-fine:bg-app/70 max-md:h-auto max-md:py-3"
            >
              {/* Phones: a stacked card instead of seven columns */}
              <div role="cell" className="grid min-w-0 flex-1 gap-1.5 md:hidden">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="t-14 min-w-0 truncate font-medium text-fg">{nameOf(r)}</span>
                  <span className="ml-auto shrink-0">
                    <StatusBadge status={r.status} />
                  </span>
                </div>
                <p className="t-14 text-table">
                  {r.type} · {dateRange(r)} · {r.duration}
                </p>
                {r.notes ? <p className="t-12 line-clamp-2 leading-[1.35] text-fg-2">{r.notes}</p> : null}
              </div>
              <div className="contents max-md:hidden">
                <div role="cell" className="w-[184px] shrink-0 truncate px-3">
                  <Link href={`/admin/employees/${r.employeeId}`} className="t-14 text-fg hover-fine:underline">
                    {nameOf(r)}
                  </Link>
                </div>
                <div role="cell" className="flex w-28 shrink-0 items-center overflow-hidden px-3">
                  <StatusBadge status={r.status} />
                </div>
                <div role="cell" className="t-14 flex w-32 shrink-0 items-center gap-1.5 truncate px-3 text-table">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--event-${LEAVE_COLORS[r.type]}-fg)` }} />
                  <span className="truncate">{r.type}</span>
                </div>
                <div role="cell" className="t-14 w-[104px] shrink-0 truncate px-3 text-table">
                  {r.duration}
                </div>
                <div role="cell" className="t-14 w-[148px] shrink-0 truncate px-3 text-table">
                  {formatLong(r.from)}
                </div>
                <div role="cell" className="t-14 w-[148px] shrink-0 truncate px-3 text-table">
                  {r.from === r.to ? "—" : formatLong(r.to)}
                </div>
                <div role="cell" className="t-14 min-w-0 flex-1 overflow-hidden px-3 text-table">
                  <span className="block truncate" title={r.notes}>
                    {r.notes}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <SearchXIcon className="size-5 text-icon" />
              <p className="t-14 text-fg">No leave matches</p>
              <p className="t-12 text-fg-2">Try a different search or reset the filters.</p>
              <Button size="sm" className="mt-1" onClick={reset}>
                Reset
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <AddLeaveDialog open={adding} employees={employees} requests={requests} stats={stats} today={today} onClose={() => setAdding(false)} />
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
