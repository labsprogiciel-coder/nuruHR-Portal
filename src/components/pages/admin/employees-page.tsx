"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PlusIcon, SearchIcon, SearchXIcon, UsersIcon } from "lucide-react";
import { FilterMenu, type FilterGroup } from "@/components/filter-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLong, formatShort } from "@/lib/dates";
import { yearsOfService } from "@/lib/labour-code";
import { formatDays, plural } from "@/lib/leave";
import { isOff } from "@/lib/team";
import type { ContractType } from "@/lib/types";
import { Card, EmptyState, PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { EmployeeDialog } from "./employee-dialog";
import { ContractBadge, EmployeeAvatar, useTeam } from "./shared";

const CONTRACTS: ContractType[] = ["CDI", "CDD", "Apprentice", "Intern"];

export function EmployeesPage() {
  const router = useRouter();
  const { today, employees, everyone, stats, requests } = useTeam();
  const [view, setView] = useState<"current" | "former">("current");
  const [adding, setAdding] = useState(false);
  const former = useMemo(() => everyone.filter((e) => !employees.includes(e)), [everyone, employees]);
  const shown = view === "current" ? employees : former;
  const departments = useMemo(() => [...new Set(shown.map((e) => e.department))].sort(), [shown]);
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string[] | null>(null);
  const [contractFilter, setContractFilter] = useState<ContractType[]>(CONTRACTS);
  const selectedDepts = deptFilter ?? departments;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shown
      .filter(
        (e) =>
          selectedDepts.includes(e.department) &&
          contractFilter.includes(e.contract) &&
          (!q || [e.name, e.jobTitle, e.department, e.location, e.email].some((v) => v.toLowerCase().includes(q))),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shown, query, selectedDepts, contractFilter]);

  const groups: FilterGroup[] = [
    {
      id: "department",
      label: "Department",
      type: "multi",
      value: selectedDepts,
      onChange: (v) => setDeptFilter(v),
      options: departments.map((d) => ({ value: d, label: d })),
    },
    {
      id: "contract",
      label: "Contract",
      type: "multi",
      value: contractFilter,
      onChange: (v) => setContractFilter(v as ContractType[]),
      options: CONTRACTS.map((c) => ({ value: c, label: c })),
    },
  ];
  const activeCount = Number(selectedDepts.length !== departments.length) + Number(contractFilter.length !== CONTRACTS.length);

  return (
    <PageRoot>
      <PageHeader
        title="Employees"
        description={`${plural(employees.length, "person", "people")} · ${plural(new Set(employees.map((e) => e.department)).size, "department", "departments")}`}
        actions={
          <Button variant="brand" onClick={() => setAdding(true)}>
            <PlusIcon /> Add employee
          </Button>
        }
      />

      <div className="z-10 flex flex-wrap items-center gap-2 border-b border-hairline bg-surface px-4 py-3 max-md:py-2.5">
        <Tabs
          value={view}
          onValueChange={(v) => {
            setView(v as "current" | "former");
            setDeptFilter(null);
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger value="current" className="t-14 salt h-8 gap-1.5 px-2.5 text-[14px] data-active:text-fg">
              Current
              <span className="t-12 text-placeholder tabular-nums">{employees.length}</span>
            </TabsTrigger>
            <TabsTrigger value="former" className="t-14 salt h-8 gap-1.5 px-2.5 text-[14px] data-active:text-fg">
              Former
              <span className="t-12 text-placeholder tabular-nums">{former.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-md:min-w-0 max-md:flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-icon" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, office"
            aria-label="Search employees"
            className="h-9 w-64 pl-8 max-md:h-10 max-md:w-full max-md:text-[16px]"
          />
        </div>
        <FilterMenu
          title="Filter employees"
          groups={groups}
          activeCount={activeCount}
          onReset={() => {
            setDeptFilter(null);
            setContractFilter(CONTRACTS);
          }}
        />
      </div>

      <div className="p-4 md:p-5">
        <Card className="overflow-hidden">
          <div className="flex h-10 items-center gap-3 border-b border-hairline bg-app px-4 max-md:hidden" role="row">
            <span className="t-14 min-w-0 flex-1 text-fg-2">Name</span>
            <span className="t-14 w-48 shrink-0 text-fg-2">Department</span>
            <span className="t-14 w-44 shrink-0 text-fg-2">Contract</span>
            <span className="t-14 w-36 shrink-0 text-fg-2">Started</span>
            <span className="t-14 w-28 shrink-0 text-right text-fg-2">{view === "current" ? "Leave left" : "Left on"}</span>
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title={view === "current" ? "No one on the team yet" : "No former employees"}
              hint={view === "current" ? "Add your first employee to start." : "People you record a departure for move here after their last day."}
            />
          ) : rows.length === 0 ? (
            <EmptyState icon={<SearchXIcon />} title="No one matches" hint="Try another name or reset the filters." />
          ) : (
            <ul className="divide-y divide-subtle">
              {rows.map((e) => {
                const years = yearsOfService(e.startDate, today);
                const off = isOff(requests, e.id, today);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/admin/employees/${e.id}`}
                      className="flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none transition-colors duration-150 hover-fine:bg-app/70 focus-visible:bg-hover"
                    >
                      <EmployeeAvatar employee={e} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="t-14 flex items-center gap-2 text-fg">
                          <span className="truncate">{e.name}</span>
                          {off && view === "current" ? <span className="t-12 shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-brand">Away</span> : null}
                          {e.departure && view === "current" ? (
                            <span className="t-12 shrink-0 rounded-md bg-[var(--status-warning-tint)] px-1.5 py-0.5 text-[var(--status-warning)]">
                              Leaving {formatShort(e.departure.date)}
                            </span>
                          ) : null}
                        </span>
                        <span className="t-12 truncate text-fg-2">
                          {e.jobTitle}
                          <span className="md:hidden"> · {e.department}</span>
                        </span>
                      </span>
                      <span className="t-14 w-48 shrink-0 truncate text-table max-md:hidden">
                        {e.department}
                        <span className="t-12 block text-fg-2">{e.location}</span>
                      </span>
                      <span className="w-44 shrink-0 max-md:hidden">
                        <ContractBadge employee={e} />
                      </span>
                      <span className="t-14 w-36 shrink-0 text-table max-md:hidden">
                        {formatLong(e.startDate)}
                        <span className="t-12 block text-fg-2">{years ? plural(years, "year", "years") : "This year"}</span>
                      </span>
                      {view === "current" ? (
                        <span className="t-14 w-28 shrink-0 text-right text-fg tabular-nums max-md:w-auto">
                          {formatDays(stats.get(e.id)?.available ?? 0)}
                          <span className="t-12 block text-fg-2">days</span>
                        </span>
                      ) : (
                        <span className="t-14 w-28 shrink-0 text-right text-table max-md:w-auto">
                          {e.departure ? formatShort(e.departure.date) : "—"}
                          <span className="t-12 block text-fg-2">{e.departure?.reason}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <EmployeeDialog open={adding} team={everyone} onClose={() => setAdding(false)} onAdded={(id) => router.push(`/admin/employees/${id}`)} />
    </PageRoot>
  );
}
