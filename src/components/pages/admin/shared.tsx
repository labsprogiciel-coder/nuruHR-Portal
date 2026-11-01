"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLong, formatShort } from "@/lib/dates";
import { DEDUCTED, FAMILY_EVENT_DAYS } from "@/lib/labour-code";
import { formatDays, LEAVE_COLORS, type LeaveStats } from "@/lib/leave";
import { allRequests, employeeLeaveStats, employees as withProfile, isCurrent } from "@/lib/team";
import type { Employee, TeamRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-today";
import { useAppStore } from "@/stores/app-store";
import { StatusBadge } from "@/components/time-off/status-badge";

/**
 * The team, every leave request, and each employee's balance, recomputed only when data changes.
 * `employees` is who works here today; `everyone` adds former employees, whose files stay
 * reachable (byId covers both).
 */
export function useTeam() {
  const today = useToday();
  const team = useAppStore((s) => s.team);
  const teamRequests = useAppStore((s) => s.teamRequests);
  const requests = useAppStore((s) => s.requests);
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const holidays = useAppStore((s) => s.holidays);

  return useMemo(() => {
    const state = { team, teamRequests, requests, profile, settings, holidays };
    const everyone = withProfile(state);
    const employees = everyone.filter((e) => isCurrent(e, today));
    const byId = new Map(everyone.map((e) => [e.id, e]));
    const stats = new Map<string, LeaveStats>(everyone.map((e) => [e.id, employeeLeaveStats(e, state, today)]));
    return { today, employees, everyone, byId, stats, requests: allRequests(state) };
  }, [team, teamRequests, requests, profile, settings, holidays, today]);
}

/** Initials tile, in the same style as the account menu. */
export function EmployeeAvatar({ employee, className }: { employee: Pick<Employee, "initials">; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-tint font-inter text-[13px] leading-none font-semibold tracking-[-0.2px] text-brand",
        className,
      )}
    >
      {employee.initials}
    </span>
  );
}

/** CDI / CDD / Apprentice / Intern, with the end date when the contract has one. */
export function ContractBadge({ employee, className }: { employee: Pick<Employee, "contract" | "contractEnd">; className?: string }) {
  return (
    <span
      className={cn(
        "t-12 inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] border px-1.5 whitespace-nowrap",
        employee.contract === "CDI"
          ? "border-hairline bg-app text-fg-2"
          : "border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] text-[var(--status-warning)]",
        className,
      )}
    >
      {employee.contract}
      {employee.contractEnd ? <span className="opacity-80">· until {formatShort(employee.contractEnd)}</span> : null}
    </span>
  );
}

export function dateRange(r: Pick<TeamRequest, "from" | "to">) {
  return r.from === r.to ? formatLong(r.from) : `${formatShort(r.from)} – ${formatShort(r.to)}, ${r.to.slice(0, 4)}`;
}

/** What approving this request does to the employee's balance, per the Labour Code. */
function balanceNote(r: TeamRequest, stats: LeaveStats | undefined) {
  if (r.type === "Sick") return "Not deducted · needs a medical certificate";
  if (r.type === "Maternity") return "Not deducted · 14 weeks";
  if (!stats) return null;
  // Pending requests are already counted in the stats, so these are the figures after approval.
  if (r.type === "Family event") {
    return `Free up to ${FAMILY_EVENT_DAYS} days a year · ${formatDays(stats.familyLeft)} left after this, ${formatDays(stats.available)} annual days left`;
  }
  if (!DEDUCTED[r.type]) return null;
  return `${formatDays(stats.available)} days left after this`;
}

/**
 * One request in an approval list: who, what, when, the effect on their balance, and
 * approve / decline buttons while it's pending (the status badge once it's decided).
 */
export function ApprovalRow({
  request: r,
  employee,
  stats,
  showEmployee = true,
}: {
  request: TeamRequest;
  employee: Employee | undefined;
  stats: LeaveStats | undefined;
  showEmployee?: boolean;
}) {
  const review = useAppStore((s) => s.reviewRequest);
  const note = r.status === "pending" ? balanceNote(r, stats) : null;

  return (
    <li className="flex items-start gap-3 px-4 py-3 max-md:flex-wrap">
      {showEmployee && employee ? <EmployeeAvatar employee={employee} /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {showEmployee && employee ? (
            <Link href={`/admin/employees/${employee.id}`} className="t-14 truncate text-fg hover-fine:underline">
              {employee.name}
            </Link>
          ) : null}
          <span className="t-14 inline-flex items-center gap-1.5 text-fg-2">
            <span className="size-2 rounded-full" style={{ background: `var(--event-${LEAVE_COLORS[r.type]}-fg)` }} />
            {r.type}
          </span>
        </div>
        <p className="t-14 text-table">
          {dateRange(r)} · {r.duration}
        </p>
        {r.notes ? <p className="t-12 line-clamp-2 leading-[1.4] text-fg-2">{r.notes}</p> : null}
        {note ? <p className="t-12 text-fg-2">{note}</p> : null}
      </div>
      {r.status === "pending" ? (
        <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:[&>*]:h-10 max-md:[&>*]:flex-1">
          <Button size="sm" onClick={() => review(r.id, "declined")} aria-label={`Decline ${employee?.name ?? ""} ${r.type}`}>
            <XIcon /> Decline
          </Button>
          <Button size="sm" variant="brand" onClick={() => review(r.id, "approved")} aria-label={`Approve ${employee?.name ?? ""} ${r.type}`}>
            <CheckIcon /> Approve
          </Button>
        </div>
      ) : (
        <StatusBadge status={r.status} />
      )}
    </li>
  );
}

/** Read-only label / value rows for an employee file. */
export function FieldList({ rows }: { rows: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-subtle">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-h-11 items-center gap-4 px-4 py-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1">
          <dt className="t-14 w-40 shrink-0 text-fg-2">{label}</dt>
          <dd className="t-14 min-w-0 flex-1 text-fg">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
