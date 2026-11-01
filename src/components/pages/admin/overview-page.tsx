"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRightIcon, CalendarCheck2Icon, CalendarHeartIcon, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, formatShort } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/leave";
import { hrAlerts, inDays, isOff } from "@/lib/team";
import { useAppStore, selectWorkspaceName } from "@/stores/app-store";
import { openOverlay } from "@/stores/overlay-store";
import { Card, CardHeader, EmptyState, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { ApprovalRow, dateRange, EmployeeAvatar, useTeam } from "./shared";

export function AdminOverviewPage() {
  const company = useAppStore(selectWorkspaceName);
  const { today, employees, byId, stats, requests } = useTeam();

  const data = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").sort((a, b) => a.from.localeCompare(b.from));
    const offToday = employees.filter((e) => isOff(requests, e.id, today));
    const horizon = addDays(today, 14);
    const away = requests
      .filter((r) => r.status === "approved" && r.to >= today && r.from <= horizon)
      .sort((a, b) => a.from.localeCompare(b.from));
    const permanent = employees.filter((e) => e.contract === "CDI").length;
    const payroll = employees.reduce((n, e) => n + e.monthlySalary, 0);
    return { pending, offToday, away, permanent, payroll, alerts: hrAlerts(employees, today) };
  }, [requests, employees, today]);

  const waitingPeople = new Set(data.pending.map((r) => r.employeeId)).size;

  return (
    <PageRoot>
      <PageHeader
        title="HR overview"
        description={`${company} · ${plural(employees.length, "employee", "employees")}`}
        actions={
          <>
            <Button onClick={() => openOverlay({ kind: "holidays" })}>Holidays</Button>
            <Button onClick={() => openOverlay({ kind: "policy" })}>Leave policy</Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        <StatGrid>
          <StatTile
            icon="per-year"
            label="Employees"
            value={employees.length}
            hint={`${data.permanent} permanent (CDI) · ${employees.length - data.permanent} fixed-term or training`}
            href="/admin/employees"
          />
          <StatTile
            icon="pending"
            label="Waiting for approval"
            value={data.pending.length}
            hint={
              data.pending.length
                ? `From ${plural(waitingPeople, "person", "people")} · next starts ${formatShort(data.pending[0].from)}`
                : "Nothing to review"
            }
            href="/admin/approvals"
          />
          <StatTile
            icon="upcoming"
            label="Off today"
            value={data.offToday.length}
            hint={data.offToday.length ? data.offToday.map((e) => e.name.split(" ")[0]).join(", ") : "Everyone is in"}
          />
          <StatTile
            icon="available"
            label="Monthly payroll"
            value={formatMoney(data.payroll, undefined, { compact: true })}
            hint="Gross salaries, before CNSS and tax"
            href="/admin/payroll"
          />
        </StatGrid>

        <div className="grid items-start gap-4 md:gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title="Waiting for approval"
              description="Oldest dates first"
              actions={
                <Button variant="ghost" size="sm" asChild className="h-9 px-3">
                  <Link href="/admin/approvals">
                    All requests <ArrowRightIcon />
                  </Link>
                </Button>
              }
            />
            {data.pending.length === 0 ? (
              <EmptyState icon={<InboxIcon />} title="You're all caught up" hint="New leave requests will show up here." />
            ) : (
              <ul className="divide-y divide-subtle">
                {data.pending.slice(0, 4).map((r) => (
                  <ApprovalRow key={r.id} request={r} employee={byId.get(r.employeeId)} stats={stats.get(r.employeeId)} />
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 md:gap-5">
            <Card>
              <CardHeader title="Who's away" description="Approved leave in the next two weeks" />
              {data.away.length === 0 ? (
                <EmptyState icon={<CalendarCheck2Icon />} title="Everyone is in" hint="No approved leave in the next 14 days." />
              ) : (
                <ul className="grid p-1.5">
                  {data.away.map((r) => {
                    const e = byId.get(r.employeeId);
                    if (!e) return null;
                    return (
                      <li key={r.id}>
                        <Link
                          href={`/admin/employees/${e.id}`}
                          className="flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors duration-150 hover-fine:bg-hover focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <EmployeeAvatar employee={e} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="t-14 truncate text-fg">{e.name}</span>
                            <span className="t-12 truncate text-fg-2">
                              {r.type} · {dateRange(r)}
                            </span>
                          </span>
                          {r.from <= today ? (
                            <span className="t-12 shrink-0 rounded-md bg-brand-tint px-1.5 py-1 text-brand">Away now</span>
                          ) : (
                            <span className="t-12 shrink-0 text-fg-2">{inDays(today, r.from)}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Coming up" description="Contract ends, trial periods and anniversaries · 60 days" />
              {data.alerts.length === 0 ? (
                <EmptyState icon={<CalendarHeartIcon />} title="Nothing coming up" hint="No contract or trial ends in the next 60 days." />
              ) : (
                <ul className="grid p-1.5">
                  {data.alerts.map((a) => {
                    const e = byId.get(a.employeeId);
                    if (!e) return null;
                    const urgent = a.kind !== "anniversary";
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/admin/employees/${e.id}`}
                          className="flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition-colors duration-150 hover-fine:bg-hover focus-visible:ring-2 focus-visible:ring-brand/40"
                        >
                          <EmployeeAvatar employee={e} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="t-14 truncate text-fg">{e.name}</span>
                            <span className={urgent ? "t-12 truncate text-danger" : "t-12 truncate text-fg-2"}>
                              {a.label} · {formatShort(a.date)}
                            </span>
                          </span>
                          <span className="t-12 shrink-0 text-fg-2">{inDays(today, a.date)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageRoot>
  );
}
