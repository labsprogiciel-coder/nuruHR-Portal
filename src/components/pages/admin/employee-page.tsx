"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeftIcon, CalendarX2Icon, MailIcon, PackageOpenIcon, PhoneIcon, UserXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLong } from "@/lib/dates";
import { seniorityBonusDays, yearsOfService } from "@/lib/labour-code";
import { formatDays, plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import { computePayslip } from "@/lib/payroll";
import { inDays, ME } from "@/lib/team";
import type { Asset } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { AssetRow, AssetStatusBadge, AssignAssetDialog, heldSince } from "@/components/assets/shared";
import { Card, CardHeader, EmptyState, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { AssetActions } from "./assets-page";
import { ApprovalRow, ContractBadge, EmployeeAvatar, FieldList, useTeam } from "./shared";

export function EmployeePage({ id }: { id: string }) {
  const { today, employees, byId, stats, requests } = useTeam();
  const allAssets = useAppStore((s) => s.assets);
  const assets = useMemo(() => allAssets.filter((a) => a.employeeId === id), [allAssets, id]);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const e = byId.get(id);
  const s = stats.get(id);
  const history = useMemo(
    () =>
      requests
        .filter((r) => r.employeeId === id && r.status !== "cancelled")
        .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.from.localeCompare(a.from)),
    [requests, id],
  );

  if (!e || !s) {
    return (
      <PageRoot>
        <PageHeader title="Employee not found" />
        <EmptyState
          icon={<UserXIcon />}
          title="This employee isn't in your workspace"
          action={
            <Button asChild className="h-9 px-3.5">
              <Link href="/admin/employees">Back to employees</Link>
            </Button>
          }
        />
      </PageRoot>
    );
  }

  const years = yearsOfService(e.startDate, today);
  const nextBonus = [20, 25, 30].find((y) => y > years);
  const pending = history.filter((r) => r.status === "pending").length;

  return (
    <PageRoot>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <EmployeeAvatar employee={e} className="size-7 rounded-lg text-[11px]" />
            <span className="truncate">{e.name}</span>
          </span>
        }
        description={`${e.jobTitle} · ${e.department} · ${e.location}`}
        actions={
          <>
            <Button asChild>
              <Link href="/admin/employees">
                <ArrowLeftIcon /> Employees
              </Link>
            </Button>
            <Button asChild>
              <a href={`mailto:${e.email}`}>
                <MailIcon /> Email
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        <StatGrid>
          <StatTile icon="available" label="Leave available" value={formatDays(s.available)} hint={`of ${plural(s.contract + s.carryover, "day", "days")} this year`} />
          <StatTile
            icon="per-year"
            label="Entitlement"
            value={formatDays(s.contract)}
            hint={s.seniority ? `Incl. ${s.seniority} for seniority` : nextBonus ? `+${seniorityBonusDays(nextBonus)} days at ${nextBonus} years` : "2.5 days per month"}
          />
          <StatTile icon="upcoming" label="Taken and booked" value={formatDays(s.taken + s.upcoming)} hint={`${formatDays(s.upcoming)} still ahead`} />
          <StatTile icon="pending" label="Pending" value={pending} hint={pending ? `${plural(s.pendingDays, "day", "days")} held` : "Nothing to review"} />
        </StatGrid>

        <div className="grid items-start gap-4 md:gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-4 md:gap-5">
            <Card>
              <CardHeader title="Contract and pay" description="Under the Burkina Faso Labour Code" actions={<ContractBadge employee={e} />} />
              <FieldList
                rows={[
                  ["Contract", e.contract === "CDI" ? "Permanent (CDI)" : e.contractEnd ? `${e.contract} until ${formatLong(e.contractEnd)} · ${inDays(today, e.contractEnd).toLowerCase()}` : e.contract],
                  ["Start date", `${formatLong(e.startDate)} · ${years ? plural(years, "year", "years") : "less than a year"}`],
                  ...(e.trialEnd && e.trialEnd >= today ? ([["Trial period", `Ends ${formatLong(e.trialEnd)}`]] as [string, string][]) : []),
                  ["Gross monthly salary", formatMoney(e.monthlySalary)],
                  ["Net monthly pay", `${formatMoney(computePayslip(e).net)} · estimate after CNSS and IUTS`],
                  ["CNSS number", <span key="cnss" className="font-mono text-[13px]">{e.cnssNumber}</span>],
                  ["Dependents", e.dependents ? plural(e.dependents, "person", "people") : "None"],
                  ["Carryover days", e.id === ME ? `${formatDays(s.carryover)} (from their settings)` : formatDays(e.carryoverDays)],
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Contact" />
              <FieldList
                rows={[
                  ["Email", <a key="email" href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 text-brand hover-fine:underline"><MailIcon className="size-3.5" />{e.email}</a>],
                  ["Phone", <a key="phone" href={`tel:${e.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-brand hover-fine:underline"><PhoneIcon className="size-3.5" />{e.phone}</a>],
                  ["Manager", e.manager],
                  ["Office", e.location],
                ]}
              />
            </Card>
            <Card>
              <CardHeader
                title="Equipment"
                description={assets.length ? `${formatMoney(assets.reduce((n, a) => n + a.value, 0))} of company property` : "Nothing assigned"}
                actions={
                  <Button variant="ghost" size="sm" asChild className="h-9 px-3">
                    <Link href="/admin/assets">All equipment</Link>
                  </Button>
                }
              />
              {assets.length === 0 ? (
                <EmptyState icon={<PackageOpenIcon />} title="No equipment" hint="Assign laptops, phones or vehicles from the equipment list." />
              ) : (
                <ul className="divide-y divide-subtle">
                  {assets.map((a) => (
                    <AssetRow
                      key={a.id}
                      asset={a}
                      meta={heldSince(a)}
                      trailing={
                        <>
                          <AssetStatusBadge asset={a} />
                          <AssetActions asset={a} onAssign={() => setAssigning(a)} />
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Leave" description={pending ? `${plural(pending, "request", "requests")} waiting for you` : "All requests this year and next"} />
            {history.length === 0 ? (
              <EmptyState icon={<CalendarX2Icon />} title="No leave yet" hint="Requests show up here as soon as they're submitted." />
            ) : (
              <ul className="divide-y divide-subtle">
                {history.map((r) => (
                  <ApprovalRow key={r.id} request={r} employee={e} stats={s} showEmployee={false} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <AssignAssetDialog asset={assigning} employees={employees} onClose={() => setAssigning(null)} />
    </PageRoot>
  );
}
