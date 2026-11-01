"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CalendarX2Icon,
  DoorOpenIcon,
  FileTextIcon,
  HeartHandshakeIcon,
  MailIcon,
  PackageOpenIcon,
  PencilIcon,
  PhoneIcon,
  PrinterIcon,
  UndoIcon,
  UserXIcon,
} from "lucide-react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLong, monthName } from "@/lib/dates";
import { seniorityBonusDays, yearsOfService } from "@/lib/labour-code";
import { formatDays, plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import { ALLOWANCES, computePayslip, normalizeSlip } from "@/lib/payroll";
import { printPayslip } from "@/lib/payroll-documents";
import { employedIn, inDays, ME } from "@/lib/team";
import type { Asset } from "@/lib/types";
import { selectWorkspaceName, useAppStore } from "@/stores/app-store";
import { AssetRow, AssetStatusBadge, AssignAssetDialog, heldSince } from "@/components/assets/shared";
import { Card, CardHeader, EmptyState, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { AdvancesCard } from "./advances-card";
import { AssetActions } from "./assets-page";
import { DepartureDialog, printWorkCertificate } from "./departure-dialog";
import { EmployeeDialog } from "./employee-dialog";
import { ApprovalRow, ContractBadge, EmployeeAvatar, FieldList, useTeam } from "./shared";

const TABS = [
  { value: "info", label: "Info" },
  { value: "contact", label: "Contact" },
  { value: "pay", label: "Pay" },
  { value: "equipment", label: "Equipment" },
  { value: "benefits", label: "Benefits" },
  { value: "documents", label: "Documents" },
  { value: "leave", label: "Leave" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function EmployeePage({ id }: { id: string }) {
  const { today, employees, everyone, byId, stats, requests } = useTeam();
  const allAssets = useAppStore((s) => s.assets);
  const company = useAppStore(selectWorkspaceName);
  const cancelDeparture = useAppStore((s) => s.cancelDeparture);
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const assets = useMemo(() => allAssets.filter((a) => a.employeeId === id), [allAssets, id]);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const benefits = useAppStore((s) => s.benefits);
  const myDocuments = useAppStore((s) => s.documents);
  const runs = useAppStore((s) => s.payrollRuns);
  const payrollInputs = useAppStore((s) => s.payrollInputs);
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
  const left = !!e.departure && e.departure.date < today;
  const estimate = computePayslip(e);
  const enrolled = e.id === ME ? benefits.filter((b) => b.enrolled) : [];

  // Payslips for the months HR closed (newest first), the work certificate once a departure is
  // recorded, and, for the signed-in user, their own files.
  const docs: { id: string; name: string; meta: string; open?: () => void }[] = [];
  if (e.departure) {
    const dep = e.departure;
    docs.push({ id: "certificate", name: "Work certificate (certificat de travail)", meta: `Last day ${formatLong(dep.date)}`, open: () => printWorkCertificate(e, company, today) });
  }
  for (const [month, run] of Object.entries(runs).sort(([a], [b]) => b.localeCompare(a))) {
    const frozen = run.lines?.[e.id];
    if (!frozen && (run.lines || !employedIn(e, month))) continue;
    const slip = frozen ? normalizeSlip(frozen) : computePayslip(e, payrollInputs[month]?.[e.id]);
    const label = `${monthName(month + "-01")} ${month.slice(0, 4)}`;
    docs.push({
      id: `payslip-${month}`,
      name: `Payslip · ${label}`,
      meta: `${run.status === "paid" ? "Paid" : "Validated"} · ${formatMoney(slip.toPay)} to pay`,
      open: () => printPayslip(e, slip, month, company),
    });
  }
  if (e.id === ME) {
    for (const d of myDocuments) docs.push({ id: d.id, name: d.name, meta: `${d.category} · added ${formatLong(d.uploadedAt.slice(0, 10))}` });
  }
  const counts: Partial<Record<Tab, number>> = { equipment: assets.length, documents: docs.length, leave: pending };

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
            <Button onClick={() => setEditing(true)}>
              <PencilIcon /> Edit
            </Button>
            {e.id !== ME ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" aria-label={`More actions for ${e.name}`}>
                    <Icon name="more" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {e.departure ? (
                    <>
                      <DropdownMenuItem onSelect={() => printWorkCertificate(e, company, today)}>
                        <FileTextIcon /> Work certificate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => cancelDeparture(e.id)}>
                        <UndoIcon /> {left ? "Bring back to the team" : "Cancel departure"}
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={() => setLeaving(true)}>
                      <DoorOpenIcon /> Record departure
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        {e.departure ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3.5 py-3"
          >
            <DoorOpenIcon className="size-4 shrink-0 text-[var(--status-warning)]" />
            <p className="t-14 min-w-0 flex-1 text-fg">
              {left ? "Left" : "Leaving"} on {formatLong(e.departure.date)} · {e.departure.reason}
              {!left ? ` · ${inDays(today, e.departure.date).toLowerCase()}` : ""}
              {e.departure.note ? <span className="t-12 block text-fg-2">{e.departure.note}</span> : null}
            </p>
            <Button size="sm" onClick={() => printWorkCertificate(e, company, today)}>
              <FileTextIcon /> Work certificate
            </Button>
          </div>
        ) : null}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-w-0 gap-4 md:gap-5">
          <div className="scroll-thin -mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <TabsList className="h-9" aria-label="Employee file sections">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="t-14 salt h-8 gap-1.5 px-2.5 text-[14px] data-active:text-fg">
                  {t.label}
                  {counts[t.value] ? <span className="t-12 text-placeholder tabular-nums">{counts[t.value]}</span> : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="info" className="grid items-start gap-4 md:gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Job" />
              <FieldList
                rows={[
                  ["Job title", e.jobTitle],
                  ["Department", e.department],
                  ["Reports to", e.manager || "No one"],
                  ["Office", e.location],
                  ["Category", e.executive ? "Executive (cadre)" : "Staff"],
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Contract" description="Under the Burkina Faso Labour Code" actions={<ContractBadge employee={e} />} />
              <FieldList
                rows={[
                  ["Contract", e.contract === "CDI" ? "Permanent (CDI)" : e.contractEnd ? `${e.contract} until ${formatLong(e.contractEnd)} · ${inDays(today, e.contractEnd).toLowerCase()}` : e.contract],
                  ["Start date", `${formatLong(e.startDate)} · ${years ? plural(years, "year", "years") : "less than a year"}`],
                  ...(e.trialEnd && e.trialEnd >= today ? ([["Trial period", `Ends ${formatLong(e.trialEnd)}`]] as [string, string][]) : []),
                  ["CNSS number", <span key="cnss" className="font-mono text-[13px]">{e.cnssNumber || "Not issued yet"}</span>],
                  ["Dependents", e.dependents ? plural(e.dependents, "person", "people") : "None"],
                ]}
              />
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="grid items-start gap-4 md:gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader title="Contact" />
              <FieldList
                rows={[
                  ["Email", <a key="email" href={`mailto:${e.email}`} className="inline-flex items-center gap-1.5 text-brand hover-fine:underline"><MailIcon className="size-3.5" />{e.email}</a>],
                  ["Phone", e.phone ? <a key="phone" href={`tel:${e.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-brand hover-fine:underline"><PhoneIcon className="size-3.5" />{e.phone}</a> : "Not given"],
                  ["Office", e.location],
                  ["Manager", e.manager || "No one"],
                ]}
              />
            </Card>
          </TabsContent>

          <TabsContent value="pay" className="grid items-start gap-4 md:gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Salary"
                description="Gross per month, before this month's bonus or overtime"
                actions={
                  <Button variant="ghost" size="sm" asChild className="h-9 px-3">
                    <Link href="/admin/payroll">Payroll</Link>
                  </Button>
                }
              />
              <FieldList
                rows={[
                  ["Base salary", formatMoney(e.monthlySalary)],
                  ...ALLOWANCES.filter((a) => e.allowances?.[a.kind]).map((a): [string, string] => [`${a.label} allowance`, formatMoney(e.allowances![a.kind]!)]),
                  ["Gross", formatMoney(estimate.gross)],
                  ["Net, estimate", `${formatMoney(estimate.net)} · after CNSS and IUTS`],
                  ["Cost to the company", formatMoney(estimate.employerCost)],
                  ["Carried-over leave", e.id === ME ? `${formatDays(s.carryover)} days (from their settings)` : `${formatDays(e.carryoverDays)} days`],
                ]}
              />
            </Card>
            <AdvancesCard employee={e} today={today} canAdd={!left} />
          </TabsContent>

          <TabsContent value="equipment">
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
          </TabsContent>

          <TabsContent value="benefits">
            <Card>
              <CardHeader title="Benefits" description={e.id === ME ? "What they're enrolled in" : undefined} />
              {e.id === ME && enrolled.length ? (
                <ul className="divide-y divide-subtle">
                  {enrolled.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="t-14 truncate text-fg">{b.name}</span>
                        <span className="t-12 truncate text-fg-2">
                          {b.provider} · {b.category} · renews {formatLong(b.renewsOn)}
                        </span>
                      </span>
                      {b.budget > 0 ? (
                        <span className="t-14 shrink-0 text-right tabular-nums">
                          {formatMoney(b.budget - b.used)}
                          <span className="t-12 block text-fg-2">left of {formatMoney(b.budget)}</span>
                        </span>
                      ) : (
                        <span className="t-12 shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-brand">Covered</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<HeartHandshakeIcon />}
                  title="No benefits on file"
                  hint={e.id === ME ? "They haven't enrolled in any benefit yet." : "Benefit enrolment isn't recorded for this employee yet."}
                />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader title="Documents" description="Payslips from payroll, HR letters and files on record" />
              {docs.length === 0 ? (
                <EmptyState icon={<FileTextIcon />} title="No documents yet" hint="Payslips appear here once a payroll month is validated." />
              ) : (
                <ul className="divide-y divide-subtle">
                  {docs.map((d) => (
                    <li key={d.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                      <FileTextIcon className="size-4 shrink-0 text-icon" />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="t-14 truncate text-fg">{d.name}</span>
                        <span className="t-12 truncate text-fg-2">{d.meta}</span>
                      </span>
                      {d.open ? (
                        <Button size="sm" onClick={d.open}>
                          <PrinterIcon /> Print
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="grid gap-4 md:gap-5">
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
            <Card>
              <CardHeader title="Requests" description={pending ? `${plural(pending, "request", "requests")} waiting for you` : "All requests this year and next"} />
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
          </TabsContent>
        </Tabs>
      </div>
      <AssignAssetDialog asset={assigning} employees={employees} onClose={() => setAssigning(null)} />
      <EmployeeDialog open={editing} employee={e} team={everyone} onClose={() => setEditing(false)} />
      {e.id !== ME ? (
        <DepartureDialog open={leaving} employee={e} leaveLeft={s.available} assets={assets} today={today} onClose={() => setLeaving(false)} />
      ) : null}
    </PageRoot>
  );
}
