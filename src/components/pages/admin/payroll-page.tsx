"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BanknoteIcon, CheckIcon, DownloadIcon, InfoIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addMonths, formatLong, monthName } from "@/lib/dates";
import { plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import { computePayslip, PAYROLL_RULES, payrollTotals, type Payslip } from "@/lib/payroll";
import type { Employee, PayrollRun } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { Card, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { EmployeeAvatar, FieldList, useTeam } from "./shared";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const monthLabel = (month: string) => `${monthName(month + "-01")} ${month.slice(0, 4)}`;

const STATUS: Record<"draft" | PayrollRun["status"], { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  validated: { label: "Validated", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
};

export function PayrollPage() {
  const { today, employees } = useTeam();
  const runs = useAppStore((s) => s.payrollRuns);
  const validate = useAppStore((s) => s.validatePayroll);
  const reopen = useAppStore((s) => s.reopenPayroll);
  const markPaid = useAppStore((s) => s.markPayrollPaid);
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState<Employee | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const current = month ?? today.slice(0, 7);
  const run: PayrollRun | undefined = runs[current];
  const status: keyof typeof STATUS = run ? run.status : "draft";

  // Draft months follow today's salaries; validated and paid months show the frozen payslips.
  const lines = useMemo(() => {
    const live = Object.fromEntries(employees.map((e) => [e.id, computePayslip(e)]));
    return run?.lines ? { ...live, ...run.lines } : live;
  }, [employees, run]);
  const staff = employees.filter((e) => lines[e.id]);
  const totals = payrollTotals(staff.map((e) => lines[e.id]));
  const step = (n: number) => setMonth(addMonths(current + "-01", n).slice(0, 7));

  const exportCsv = () => {
    const rows = [
      ["Employee", "CNSS number", "Gross", "CNSS employee", "IUTS", "Net pay", "CNSS employer", "Employer cost"],
      ...staff.map((e) => {
        const s = lines[e.id];
        return [e.name, e.cnssNumber, s.gross, s.cnssEmployee, s.iuts, s.net, s.cnssEmployer, s.employerCost];
      }),
      ["Total", "", totals.gross, totals.cnssEmployee, totals.iuts, totals.net, totals.cnssEmployer, totals.employerCost],
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `payroll-${current}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageRoot>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Payroll · {monthLabel(current)}
            <StatusPill status={status} />
          </span>
        }
        description={
          status === "paid" && run?.paidAt
            ? `Paid on ${formatLong(run.paidAt.slice(0, 10))} · ${plural(staff.length, "employee", "employees")}`
            : status === "validated"
              ? `Validated on ${formatLong(run!.validatedAt.slice(0, 10))}, ready to pay`
              : `Draft from current salaries · ${plural(staff.length, "employee", "employees")}`
        }
        actions={
          <>
            <Button size="icon" aria-label="Previous month" onClick={() => step(-1)}>
              <ArrowLeftIcon />
            </Button>
            <Button size="icon" aria-label="Next month" onClick={() => step(1)}>
              <ArrowRightIcon />
            </Button>
            <Button onClick={exportCsv}>
              <DownloadIcon /> CSV
            </Button>
            {status === "draft" ? (
              <Button variant="brand" onClick={() => validate(current, lines)}>
                <CheckIcon /> Validate
              </Button>
            ) : status === "validated" ? (
              <>
                <Button onClick={() => reopen(current)}>
                  <RotateCcwIcon /> Reopen
                </Button>
                <Button variant="brand" onClick={() => markPaid(current)}>
                  <BanknoteIcon /> Mark as paid
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        <p className="t-12 flex items-start gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 py-2.5 leading-[1.45] text-fg">
          <InfoIcon className="mt-px size-3.5 shrink-0 text-[var(--status-warning)]" />
          <span>
            Estimates on base salary only. CNSS rates are confirmed; the IUTS scale still needs checking against the current Code
            général des impôts.{" "}
            <button type="button" className="text-brand underline" onClick={() => setRulesOpen(true)}>
              See the rules used
            </button>
          </span>
        </p>

        <StatGrid>
          <StatTile icon="per-year" label="Gross payroll" value={formatMoney(totals.gross, undefined, { compact: true })} hint={formatMoney(totals.gross)} />
          <StatTile icon="available" label="Net to pay" value={formatMoney(totals.net, undefined, { compact: true })} hint={`To ${plural(staff.length, "employee", "employees")}`} />
          <StatTile
            icon="pending"
            label="Due to CNSS and tax office"
            value={formatMoney(totals.cnssEmployee + totals.cnssEmployer + totals.iuts, undefined, { compact: true })}
            hint={`CNSS ${formatMoney(totals.cnssEmployee + totals.cnssEmployer)} · IUTS ${formatMoney(totals.iuts)}`}
          />
          <StatTile icon="upcoming" label="Employer cost" value={formatMoney(totals.employerCost, undefined, { compact: true })} hint="Gross + employer CNSS" />
        </StatGrid>

        <Card className="overflow-hidden">
          <div role="row" className="flex h-10 items-center gap-3 border-b border-hairline bg-app px-4 max-md:hidden">
            <span className="t-14 min-w-0 flex-1 text-fg-2">Employee</span>
            {["Gross", "CNSS 5.5%", "IUTS", "Net pay", "Employer CNSS"].map((h) => (
              <span key={h} className="t-14 w-32 shrink-0 text-right text-fg-2">
                {h}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-subtle">
            {staff.map((e) => {
              const s = lines[e.id];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(e)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-150 hover-fine:bg-app/70 focus-visible:bg-hover"
                  >
                    <EmployeeAvatar employee={e} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="t-14 truncate text-fg">{e.name}</span>
                      <span className="t-12 truncate text-fg-2">
                        <span className="md:hidden">Gross {formatMoney(s.gross)} · </span>
                        {e.jobTitle}
                      </span>
                    </span>
                    <Money value={s.gross} className="max-md:hidden" />
                    <Money value={-s.cnssEmployee} className="max-md:hidden" />
                    <Money value={-s.iuts} className="max-md:hidden" />
                    <Money value={s.net} strong />
                    <Money value={s.cnssEmployer} className="max-md:hidden text-fg-2" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex min-h-12 items-center gap-3 border-t border-hairline bg-app px-4 py-2">
            <span className="t-14 min-w-0 flex-1 text-fg">Total</span>
            <Money value={totals.gross} className="max-md:hidden" />
            <Money value={-totals.cnssEmployee} className="max-md:hidden" />
            <Money value={-totals.iuts} className="max-md:hidden" />
            <Money value={totals.net} strong />
            <Money value={totals.cnssEmployer} className="max-md:hidden text-fg-2" />
          </div>
        </Card>
      </div>

      <PayslipDialog employee={open} slip={open ? lines[open.id] : null} month={current} onClose={() => setOpen(null)} />
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </PageRoot>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS }) {
  const { label, tone } = STATUS[status];
  return (
    <span
      className="t-12 inline-flex h-[22px] items-center rounded-[6px] border px-1.5"
      style={{ background: `var(--status-${tone}-tint)`, borderColor: `var(--status-${tone}-border)`, color: `var(--status-${tone})` }}
    >
      {label}
    </span>
  );
}

function Money({ value, strong, className }: { value: number; strong?: boolean; className?: string }) {
  return (
    <span className={`t-14 w-32 shrink-0 text-right tabular-nums max-md:w-auto ${strong ? "text-fg" : "text-table"} ${className ?? ""}`}>
      {value < 0 ? "−" : ""}
      {formatMoney(Math.abs(value))}
    </span>
  );
}

function PayslipDialog({
  employee: e,
  slip: s,
  month,
  onClose,
}: {
  employee: Employee | null;
  slip: Payslip | null;
  month: string;
  onClose: () => void;
}) {
  const { cnss, iuts } = PAYROLL_RULES;
  return (
    <Dialog open={!!e} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-5 sm:max-w-[480px]">
        {e && s ? (
          <>
            <DialogHeader className="gap-1.5">
              <DialogTitle className="t-16">
                {e.name} · {monthLabel(month)}
              </DialogTitle>
              <DialogDescription className="t-14">
                {e.jobTitle} · {e.executive ? "executive" : "staff"} · {plural(e.dependents, "dependent", "dependents")} · CNSS {e.cnssNumber}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-hidden rounded-lg border border-hairline">
              <FieldList
                rows={[
                  ["Gross salary", formatMoney(s.gross)],
                  [`CNSS (${pct(cnss.employee)})`, `− ${formatMoney(s.cnssEmployee)}${s.gross > cnss.ceiling ? ` · on the ${formatMoney(cnss.ceiling)} ceiling` : ""}`],
                  [`Flat deduction (${pct(e.executive ? iuts.abatement.executive : iuts.abatement.staff)})`, formatMoney(s.abatement)],
                  ["Taxable income", formatMoney(s.taxable)],
                  ["IUTS on the scale", formatMoney(s.iutsBeforeReduction)],
                  ["Family reduction", s.familyReduction ? `− ${formatMoney(s.familyReduction)}` : "None"],
                  ["IUTS withheld", `− ${formatMoney(s.iuts)}`],
                  ["Net pay", <strong key="net">{formatMoney(s.net)}</strong>],
                  ["Employer CNSS (16%)", formatMoney(s.cnssEmployer)],
                  ["Cost to the company", formatMoney(s.employerCost)],
                ]}
              />
            </div>
            <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
              <Button asChild>
                <Link href={`/admin/employees/${e.id}`}>Employee file</Link>
              </Button>
              <Button variant="brand" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cnss, iuts } = PAYROLL_RULES;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-5 sm:max-w-[480px]">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="t-16">Payroll rules used</DialogTitle>
          <DialogDescription className="t-14">Burkina Faso, private sector. Set in src/lib/payroll.ts.</DialogDescription>
        </DialogHeader>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">CNSS · confirmed</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Employee {pct(cnss.employee)}; employer {pct(cnss.employer.pension + cnss.employer.family + cnss.employer.workAccidents)} (pension{" "}
            {pct(cnss.employer.pension)}, family benefits {pct(cnss.employer.family)}, work accidents {pct(cnss.employer.workAccidents)}), on
            salary up to {formatMoney(cnss.ceiling)} a month.
          </p>
        </section>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">IUTS · to verify</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Taxable income = gross − employee CNSS − a flat deduction of {pct(iuts.abatement.staff)} of base salary ({pct(iuts.abatement.executive)} for executives),
            rounded down to the hundred. Family reduction: {iuts.familyReduction.slice(1).map(pct).join(" / ")} of the tax for 1 / 2 / 3 / 4+ dependents.
          </p>
          <ul className="t-14 grid gap-0.5 text-fg-2 tabular-nums">
            {iuts.brackets.map(([upper, rate], i) => {
              const from = i === 0 ? 0 : iuts.brackets[i - 1][0];
              return (
                <li key={upper} className="flex justify-between">
                  <span>{upper === Infinity ? `Above ${formatMoney(from)}` : `${formatMoney(from)} – ${formatMoney(upper)}`}</span>
                  <span>{pct(rate)}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
          <Button variant="brand" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
