"use client";

import { useMemo, useState } from "react";
import { InboxIcon, SearchIcon, SearchXIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { plural } from "@/lib/leave";
import type { LeaveStatus } from "@/lib/types";
import { Card, EmptyState, PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { ApprovalRow, useTeam } from "./shared";

type Filter = Extract<LeaveStatus, "pending" | "approved" | "declined"> | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Waiting" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "all", label: "All" },
];

export function ApprovalsPage() {
  const { employees, byId, stats, requests } = useTeam();
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { pending: 0, approved: 0, declined: 0, all: 0 };
    for (const r of requests) {
      if (r.status === "cancelled") continue;
      c[r.status] += 1;
      c.all += 1;
    }
    return c;
  }, [requests]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = requests.filter((r) => {
      if (r.status === "cancelled" || (filter !== "all" && r.status !== filter)) return false;
      if (!q) return true;
      const e = byId.get(r.employeeId);
      return [e?.name, e?.department, r.type, r.notes].some((v) => v?.toLowerCase().includes(q));
    });
    // Waiting: soonest leave first, so nothing starts before it's decided. Otherwise: newest first.
    return filter === "pending"
      ? list.sort((a, b) => a.from.localeCompare(b.from))
      : list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [requests, filter, query, byId]);

  return (
    <PageRoot>
      <PageHeader
        title="Approvals"
        description={
          counts.pending
            ? `${plural(counts.pending, "request", "requests")} waiting across ${plural(employees.length, "employee", "employees")}`
            : "Every leave request has been reviewed"
        }
      />

      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-hairline bg-surface px-4 py-3 max-md:py-2.5">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="scroll-thin min-w-0 max-md:w-full max-md:overflow-x-auto">
          <TabsList className="h-9">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="t-14 salt h-8 gap-1.5 px-2.5 text-[14px] data-active:text-fg">
                {f.label}
                <span className="t-12 text-placeholder tabular-nums">{counts[f.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative ml-auto max-md:ml-0 max-md:w-full">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-icon" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, department, type"
            aria-label="Search requests"
            className="h-9 w-64 pl-8 max-md:h-10 max-md:w-full max-md:text-[16px]"
          />
        </div>
      </div>

      <div className="p-4 md:p-5">
        <Card>
          {rows.length === 0 ? (
            query ? (
              <EmptyState icon={<SearchXIcon />} title="No requests match" hint="Try another name or leave type." />
            ) : (
              <EmptyState
                icon={<InboxIcon />}
                title={filter === "pending" ? "You're all caught up" : "Nothing here yet"}
                hint={filter === "pending" ? "New leave requests will show up here." : undefined}
              />
            )
          ) : (
            <ul className="divide-y divide-subtle">
              {rows.map((r) => (
                <ApprovalRow key={r.id} request={r} employee={byId.get(r.employeeId)} stats={stats.get(r.employeeId)} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageRoot>
  );
}
