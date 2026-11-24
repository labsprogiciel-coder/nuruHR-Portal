"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  InfoIcon,
  PrinterIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Field } from "@/components/dialogs/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { addMonths, formatLong, monthName } from "@/lib/dates";
import { plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import {
  advanceSchedule,
  ALLOWANCES,
  canReopenMonth,
  canValidateMonth,
  computePayslip,
  nextMonthToValidate,
  normalizeSlip,
  PAYROLL_RULES,
  payrollTotals,
  repaidBefore,
  type Payslip,
} from "@/lib/payroll";
import { cnssDeclarationRows, downloadCsv, iutsDeclarationRows, printPayslip } from "@/lib/payroll-documents";
import {
  batchFileName,
  batchFileRows,
  isBatch,
  missingPayout,
  PAYOUT_METHODS,
  payoutAccount,
  payoutBatches,
  payoutError,
  type PayoutBatch,
} from "@/lib/payouts";
import { employedIn, monthShare } from "@/lib/team";
import type { Employee, PayrollInput, PayrollRun } from "@/lib/types";
import { cn } from "@/lib/utils";
import { selectWorkspaceName, useAppStore } from "@/stores/app-store";
import { Card, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { EmployeeAvatar, useTeam } from "./shared";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const monthLabel = (month: string) => `${monthName(month + "-01")} ${month.slice(0, 4)}`;
const EMPTY_INPUTS: Record<string, PayrollInput> = {};

const STATUS: Record<"draft" | PayrollRun["status"], { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  validated: { label: "Validated", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
};

/** "Bonus · 8 h overtime · 2 days absent" for a month's inputs. */
function inputSummary(i: PayrollInput | undefined) {
  if (!i) return "";
  const hours = (i.overtime15 ?? 0) + (i.overtime35 ?? 0);
  return [
    i.bonus ? "Bonus" : "",
    hours ? `${hours} h overtime` : "",
    i.absenceDays ? `${plural(i.absenceDays, "day", "days")} absent` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PayrollPage() {
  const { today, everyone } = useTeam();
  const company = useAppStore(selectWorkspaceName);
  const runs = useAppStore((s) => s.payrollRuns);
  const allInputs = useAppStore((s) => s.payrollInputs);
  const advances = useAppStore((s) => s.advances);
  const validate = useAppStore((s) => s.validatePayroll);
  const reopen = useAppStore((s) => s.reopenPayroll);
  const markPaid = useAppStore((s) => s.markPayrollPaid);
  const [month, setMonth] = useState<string | null>(null);
  const [open, setOpen] = useState<Employee | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  // Validating freezes the payslips and paying can't be reopened, so both ask first
  const [confirming, setConfirming] = useState<"validate" | null>(null);
  const [paying, setPaying] = useState(false);

  const current = month ?? today.slice(0, 7);
  const run: PayrollRun | undefined = runs[current];
  const status: keyof typeof STATUS = run ? run.status : "draft";
  const inputs = allInputs[current] ?? EMPTY_INPUTS;

  // Advance instalments due this month, from what validated months already withheld.
  const advanceDue = useMemo(() => {
    const due: Record<string, number> = {};
    for (const id of new Set(advances.map((a) => a.employeeId))) {
      due[id] = advanceSchedule(
        advances.filter((a) => a.employeeId === id),
        repaidBefore(runs, id, current),
        current,
      ).due;
    }
    return due;
  }, [advances, runs, current]);

  // Draft months follow today's salaries and this month's inputs for whoever is employed that
  // month; validated and paid months show exactly the frozen payslips.
  const lines = useMemo((): Record<string, Payslip> => {
    if (run?.lines) return Object.fromEntries(Object.entries(run.lines).map(([id, s]) => [id, normalizeSlip(s)]));
    const employed = everyone.filter((e) => employedIn(e, current));
    return Object.fromEntries(employed.map((e) => [e.id, computePayslip(e, inputs[e.id], advanceDue[e.id] ?? 0, monthShare(e, current))]));
  }, [everyone, run, current, inputs, advanceDue]);
  // Former employees stay in the months they were paid for
  const staff = everyone.filter((e) => lines[e.id]);
  const totals = payrollTotals(staff.map((e) => lines[e.id]));
  // Months close in order: only the one after the latest closed month can be validated, and
  // only the latest can be reopened.
  const nextToValidate = nextMonthToValidate(runs);
  const canValidate = canValidateMonth(runs, current);
  const canReopen = canReopenMonth(runs, current);
  // Salaries grouped by how each person is paid: one payment file per provider
  const batches = useMemo(() => payoutBatches(staff, lines), [staff, lines]);
  const downloadBatch = (b: PayoutBatch) => downloadCsv(batchFileName(b.method, current), batchFileRows(b, current, company));
  const step = (n: number) => setMonth(addMonths(current + "-01", n).slice(0, 7));

  const exportPayroll = () =>
    downloadCsv(`payroll-${current}.csv`, [
      ["Employee", "CNSS number", "Base", "Allowances", "Overtime", "Bonus", "Absence", "Gross", "CNSS employee", "IUTS", "Net", "Advance", "To pay", "CNSS employer", "Employer cost"],
      ...staff.map((e) => {
        const s = lines[e.id];
        const allowances = Object.values(s.allowances).reduce((n, v) => n + (v ?? 0), 0);
        return [e.name, e.cnssNumber, s.base, allowances, s.overtime, s.bonus, -s.absence, s.gross, s.cnssEmployee, s.iuts, s.net, s.advance, s.toPay, s.cnssEmployer, s.employerCost];
      }),
      ["Total", "", "", "", "", "", "", totals.gross, totals.cnssEmployee, totals.iuts, totals.net, totals.advance, totals.toPay, totals.cnssEmployer, totals.employerCost],
    ]);

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
            ? `Paid on ${formatLong(run.paidAt.slice(0, 10))} · ${plural(staff.length, "employee", "employees")}${
                run.payments?.length ? ` · ${run.payments.map((x) => PAYOUT_METHODS[x.method].label).join(", ")}` : ""
              }`
            : status === "validated"
              ? `Validated on ${formatLong(run!.validatedAt.slice(0, 10))}, ready to pay`
              : !canValidate && nextToValidate
                ? `Draft · validate ${monthLabel(nextToValidate)} first: months are closed in order`
                : `Draft · ${plural(staff.length, "employee", "employees")} · open someone to add a bonus, overtime or absence`
        }
        actions={
          <>
            <Button size="icon" aria-label="Previous month" onClick={() => step(-1)}>
              <ArrowLeftIcon />
            </Button>
            <Button size="icon" aria-label="Next month" onClick={() => step(1)}>
              <ArrowRightIcon />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <DownloadIcon /> Export <ChevronDownIcon className="opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={exportPayroll}>Payroll summary (CSV)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => downloadCsv(`declaration-cnss-${current}.csv`, cnssDeclarationRows(staff, lines))}>
                  CNSS declaration (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => downloadCsv(`declaration-iuts-${current}.csv`, iutsDeclarationRows(staff, lines))}>
                  IUTS declaration (CSV)
                </DropdownMenuItem>
                {batches.some((b) => isBatch(b.method)) ? <DropdownMenuSeparator /> : null}
                {batches
                  .filter((b) => isBatch(b.method))
                  .map((b) => (
                    <DropdownMenuItem key={b.method} onSelect={() => downloadBatch(b)}>
                      {PAYOUT_METHODS[b.method].label} payment file (CSV)
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {status === "draft" ? (
              <Button variant="brand" disabled={!canValidate} onClick={() => setConfirming("validate")}>
                <CheckIcon /> Validate
              </Button>
            ) : status === "validated" ? (
              <>
                {canReopen ? (
                  <Button onClick={() => reopen(current)}>
                    <RotateCcwIcon /> Reopen
                  </Button>
                ) : null}
                <Button variant="brand" onClick={() => setPaying(true)}>
                  <BanknoteIcon /> Pay salaries
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
            Base salary, allowances, overtime, bonuses, unpaid absence and advance repayments. CNSS rates are confirmed; the IUTS scale, the
            allowance exemptions and the overtime premiums still need checking with your accountant.{" "}
            <button type="button" className="text-brand underline" onClick={() => setRulesOpen(true)}>
              See the rules used
            </button>
          </span>
        </p>

        <StatGrid>
          <StatTile icon="per-year" label="Gross payroll" value={formatMoney(totals.gross, undefined, { compact: true })} hint={formatMoney(totals.gross)} />
          <StatTile
            icon="available"
            label="Net to pay"
            value={formatMoney(totals.toPay, undefined, { compact: true })}
            hint={totals.advance ? `After ${formatMoney(totals.advance)} of advances withheld` : `To ${plural(staff.length, "employee", "employees")}`}
          />
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
            <span className="t-14 w-32 shrink-0 text-fg-2 max-lg:hidden">Paid by</span>
            {["Gross", "CNSS 5.5%", "IUTS", "Advance", "To pay"].map((h) => (
              <span key={h} className="t-14 w-32 shrink-0 text-right text-fg-2">
                {h}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-subtle">
            {staff.map((e) => {
              const s = lines[e.id];
              const extra = run ? "" : inputSummary(inputs[e.id]);
              const paidBy = payoutLabel(e);
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
                        <span className={cn("lg:hidden", paidBy.missing && "text-warning")}> · {paidBy.label}</span>
                        {extra ? <span className="text-brand"> · {extra}</span> : null}
                      </span>
                    </span>
                    <span className={cn("t-14 w-32 shrink-0 truncate max-lg:hidden", paidBy.missing ? "text-warning" : "text-table")} title={paidBy.title}>
                      {paidBy.label}
                    </span>
                    <Money value={s.gross} className="max-md:hidden" />
                    <Money value={-s.cnssEmployee} className="max-md:hidden" />
                    <Money value={-s.iuts} className="max-md:hidden" />
                    <Money value={-s.advance} className="max-md:hidden" />
                    <Money value={s.toPay} strong />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex min-h-12 items-center gap-3 border-t border-hairline bg-app px-4 py-2">
            <span className="t-14 min-w-0 flex-1 text-fg">Total</span>
            <span className="w-32 shrink-0 max-lg:hidden" aria-hidden />
            <Money value={totals.gross} className="max-md:hidden" />
            <Money value={-totals.cnssEmployee} className="max-md:hidden" />
            <Money value={-totals.iuts} className="max-md:hidden" />
            <Money value={-totals.advance} className="max-md:hidden" />
            <Money value={totals.toPay} strong />
          </div>
        </Card>
      </div>

      <PayslipDialog
        employee={open}
        slip={open ? lines[open.id] : null}
        input={open ? inputs[open.id] : undefined}
        advanceDue={open ? (advanceDue[open.id] ?? 0) : 0}
        share={open ? monthShare(open, current) : 1}
        editable={status === "draft"}
        month={current}
        company={company}
        onClose={() => setOpen(null)}
      />
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <AlertDialog open={!!confirming} onOpenChange={(v) => !v && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-16">Validate {monthLabel(current)} payroll?</AlertDialogTitle>
            <AlertDialogDescription className="t-14 leading-[1.4]">
              {formatMoney(totals.toPay)} to {plural(staff.length, "employee", "employees")}
              {totals.advance ? `, after ${formatMoney(totals.advance)} of advances withheld` : ""}. The payslips are frozen as they are now. You can
              reopen the month until it&rsquo;s marked as paid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="brand" onClick={() => validate(current, lines)}>
              Validate payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PayDialog
        open={paying && status === "validated"}
        month={current}
        batches={batches}
        missing={missingPayout(staff, lines)}
        total={totals.toPay}
        advance={totals.advance}
        onDownload={downloadBatch}
        onClose={() => setPaying(false)}
        onPaid={() => markPaid(current, batches.map((b) => ({ method: b.method, employees: b.lines.length, total: b.total })))}
      />
    </PageRoot>
  );
}

/**
 * Pay a validated month: the salaries grouped by payment method, a payment file to upload for
 * each provider, then the confirmation that records the month as paid. The app prepares the
 * files; the money is sent from the provider's own business portal or the bank.
 */
function PayDialog({
  open,
  month,
  batches,
  missing,
  total,
  advance,
  onDownload,
  onClose,
  onPaid,
}: {
  open: boolean;
  month: string;
  batches: PayoutBatch[];
  missing: Employee[];
  total: number;
  advance: number;
  onDownload: (b: PayoutBatch) => void;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDownloaded(new Set());
  }
  const files = batches.filter((b) => isBatch(b.method));
  const pendingFiles = files.filter((b) => !downloaded.has(b.method)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-5 sm:max-w-[540px]">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="t-16">Pay {monthLabel(month)} salaries</DialogTitle>
          <DialogDescription className="t-14 leading-[1.4]">
            {formatMoney(total)} in all{advance ? `, after ${formatMoney(advance)} of advances withheld` : ""}. Download each payment file and
            upload it to that provider&rsquo;s bulk payment page, then mark the month as paid.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-hairline">
          {batches.map((b) => (
            <li key={b.method} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-14 text-fg">{PAYOUT_METHODS[b.method].label}</span>
                <span className="t-12 truncate text-fg-2">
                  {plural(b.lines.length, "employee", "employees")} · {b.lines.map((l) => l.employee.name.split(" ")[0]).join(", ")}
                </span>
              </span>
              <span className="t-14 shrink-0 text-right tabular-nums">{formatMoney(b.total)}</span>
              {isBatch(b.method) ? (
                <Button
                  size="sm"
                  className="h-9 w-[104px] shrink-0"
                  aria-label={`Download the ${PAYOUT_METHODS[b.method].label} payment file`}
                  onClick={() => {
                    onDownload(b);
                    setDownloaded((s) => new Set(s).add(b.method));
                  }}
                >
                  {downloaded.has(b.method) ? <CheckIcon /> : <DownloadIcon />} {downloaded.has(b.method) ? "Saved" : "File"}
                </Button>
              ) : (
                <span className="t-12 w-[104px] shrink-0 text-right text-fg-2">By hand</span>
              )}
            </li>
          ))}
        </ul>

        {missing.length ? (
          <p className="t-12 flex items-start gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 py-2.5 leading-[1.45] text-fg">
            <InfoIcon className="mt-px size-3.5 shrink-0 text-[var(--status-warning)]" />
            <span>
              {missing.map((e) => e.name).join(", ")} {missing.length === 1 ? "has" : "have"} no payment details on file, so they are
              listed under cash. Add a number in their employee file to include them in a
              payment file next month.
            </span>
          </p>
        ) : null}
        <p className="t-12 leading-[1.4] text-fg-2">
          Each file lists the number or account, the amount, the name and a reference. Providers use their own upload templates, so the column
          names may need adjusting; check the first upload against the provider&rsquo;s template.
        </p>

        <DialogFooter className="-mx-5 -mb-5 items-center bg-app px-5 py-3">
          {pendingFiles ? (
            <span className="t-12 text-fg-2 sm:mr-auto">
              {pendingFiles} {pendingFiles === 1 ? "file" : "files"} not downloaded yet
            </span>
          ) : null}
          <Button type="button" onClick={onClose}>
            Not yet
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={() => {
              onPaid();
              onClose();
            }}
          >
            <BanknoteIcon /> Mark as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

/** How someone is paid, for the table: the method, or a flag when nothing usable is on file. */
function payoutLabel(e: Employee): { label: string; title?: string; missing: boolean } {
  if (!e.payout) return { label: "Not set", title: "No payment details on file: paid by hand", missing: true };
  const { method, account } = e.payout;
  if (payoutError(method, account)) return { label: `${PAYOUT_METHODS[method].label} · check`, title: "The number or account on file isn't valid", missing: true };
  return { label: PAYOUT_METHODS[method].label, title: isBatch(method) ? payoutAccount(method, account) : undefined, missing: false };
}

function Money({ value, strong, className }: { value: number; strong?: boolean; className?: string }) {
  return (
    <span className={`t-14 w-32 shrink-0 text-right tabular-nums max-md:w-auto ${strong ? "text-fg" : "text-table"} ${className ?? ""}`}>
      {value < 0 ? "−" : ""}
      {value === 0 && !strong ? "—" : formatMoney(Math.abs(value))}
    </span>
  );
}

type InputDraft = { bonus: string; overtime15: string; overtime35: string; absenceDays: string; note: string };
const toInputDraft = (i?: PayrollInput): InputDraft => ({
  bonus: i?.bonus ? String(i.bonus) : "",
  overtime15: i?.overtime15 ? String(i.overtime15) : "",
  overtime35: i?.overtime35 ? String(i.overtime35) : "",
  absenceDays: i?.absenceDays ? String(i.absenceDays) : "",
  note: i?.note ?? "",
});
const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * One employee's payslip for the month. In a draft month HR can add this month's bonus,
 * overtime and unpaid absence, and the payslip updates as they type.
 */
function PayslipDialog({
  employee: e,
  slip,
  input,
  advanceDue,
  share,
  editable,
  month,
  company,
  onClose,
}: {
  employee: Employee | null;
  slip: Payslip | null;
  input: PayrollInput | undefined;
  advanceDue: number;
  /** Part of the month they were employed */
  share: number;
  editable: boolean;
  month: string;
  company: string;
  onClose: () => void;
}) {
  const save = useAppStore((s) => s.setPayrollInput);
  const [draft, setDraft] = useState<InputDraft>(() => toInputDraft(input));
  const [openFor, setOpenFor] = useState<string | null>(null);
  const key = e ? `${e.id}:${month}` : null;
  if (key !== openFor) {
    setOpenFor(key);
    if (key) setDraft(toInputDraft(input));
  }
  const set = (k: keyof InputDraft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const parsed: PayrollInput = {
    bonus: num(draft.bonus) || undefined,
    overtime15: num(draft.overtime15) || undefined,
    overtime35: num(draft.overtime35) || undefined,
    absenceDays: Math.min(PAYROLL_RULES.time.daysPerMonth, num(draft.absenceDays)) || undefined,
    note: draft.note.trim() || undefined,
  };
  const s = e && slip ? (editable ? computePayslip(e, parsed, advanceDue, share) : slip) : null;
  const { cnss, iuts } = PAYROLL_RULES;
  const changed = JSON.stringify(parsed) !== JSON.stringify(toParsed(input));

  return (
    <Dialog open={!!e} onOpenChange={(v) => !v && onClose()}>
      {/* Header and footer stay put; only the payslip between them scrolls */}
      <DialogContent className="max-h-[min(820px,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        {e && s ? (
          <>
            <DialogHeader className="gap-1.5 border-b border-hairline p-5 pb-4 pr-12">
              <DialogTitle className="t-16">
                {e.name} · {monthLabel(month)}
              </DialogTitle>
              <DialogDescription className="t-14">
                {e.jobTitle} · {e.executive ? "executive" : "staff"} · {plural(e.dependents, "dependent", "dependents")} · CNSS {e.cnssNumber || "—"}
              </DialogDescription>
            </DialogHeader>

            <div className="scroll-thin flex flex-col gap-3 overflow-y-auto p-5 [&>*]:shrink-0">
            {editable ? (
              <fieldset className="grid gap-3 rounded-lg border border-hairline bg-app p-3.5">
                <legend className="t-14 px-1 font-medium text-fg">This month</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Bonus (FCFA)" htmlFor="pi-bonus">
                    <Input id="pi-bonus" type="number" inputMode="numeric" min={0} step={1} placeholder="0" className="tabular-nums" value={draft.bonus} onChange={(ev) => set("bonus", ev.target.value)} />
                  </Field>
                  <Field label={`Overtime +${pct(PAYROLL_RULES.time.overtime.first)} (h)`} htmlFor="pi-ot15">
                    <Input id="pi-ot15" type="number" inputMode="decimal" min={0} step={0.5} placeholder="0" className="tabular-nums" value={draft.overtime15} onChange={(ev) => set("overtime15", ev.target.value)} />
                  </Field>
                  <Field label={`Overtime +${pct(PAYROLL_RULES.time.overtime.beyond)} (h)`} htmlFor="pi-ot35">
                    <Input id="pi-ot35" type="number" inputMode="decimal" min={0} step={0.5} placeholder="0" className="tabular-nums" value={draft.overtime35} onChange={(ev) => set("overtime35", ev.target.value)} />
                  </Field>
                  <Field label="Unpaid days" htmlFor="pi-absence">
                    <Input
                      id="pi-absence"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={PAYROLL_RULES.time.daysPerMonth}
                      step={0.5}
                      placeholder="0"
                      className="tabular-nums"
                      value={draft.absenceDays}
                      onChange={(ev) => set("absenceDays", ev.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Note" htmlFor="pi-note">
                  <Input id="pi-note" placeholder="e.g. Q3 sales bonus" value={draft.note} onChange={(ev) => set("note", ev.target.value)} />
                </Field>
              </fieldset>
            ) : input?.note ? (
              <p className="t-14 text-fg-2">Note: {input.note}</p>
            ) : null}

            <SlipSection
              rows={[
                [s.share ? `Base salary (${pct(s.share)} of the month)` : "Base salary", formatMoney(s.base)],
                ...ALLOWANCES.filter((a) => s.allowances[a.kind]).map((a): SlipRow => [`${a.label} allowance`, formatMoney(s.allowances[a.kind]!)]),
                ...(s.overtime ? ([["Overtime", formatMoney(s.overtime)]] as SlipRow[]) : []),
                ...(s.bonus ? ([["Bonus", formatMoney(s.bonus)]] as SlipRow[]) : []),
                ...(s.absence ? ([["Unpaid absence", `− ${formatMoney(s.absence)}`]] as SlipRow[]) : []),
                ["Gross salary", formatMoney(s.gross), "strong"],
              ]}
            />
            <SlipSection
              rows={[
                [`CNSS (${pct(cnss.employee)})`, `− ${formatMoney(s.cnssEmployee)}`],
                ["IUTS withheld", `− ${formatMoney(s.iuts)}`],
                ["Net salary", formatMoney(s.net), s.advance ? undefined : "strong"],
                ...(s.advance ? ([["Advance repayment", `− ${formatMoney(s.advance)}`], ["To pay", formatMoney(s.toPay), "strong"]] as SlipRow[]) : []),
              ]}
            />
            {/* The working behind the tax and what the month costs the company, on demand */}
            <details className="group rounded-lg border border-hairline">
              <summary className="t-14 flex h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 text-fg-2 outline-none hover-fine:text-fg focus-visible:text-fg [&::-webkit-details-marker]:hidden">
                Tax working and employer cost
                <ChevronDownIcon className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <SlipSection
                className="rounded-none border-0 border-t"
                rows={[
                  ...(s.gross > cnss.ceiling ? ([["CNSS is worked out on", `${formatMoney(cnss.ceiling)} ceiling`]] as SlipRow[]) : []),
                  ...(s.exempt ? ([["Allowances not taxed", formatMoney(s.exempt)]] as SlipRow[]) : []),
                  [`Flat deduction (${pct(e.executive ? iuts.abatement.executive : iuts.abatement.staff)} of base)`, formatMoney(s.abatement)],
                  ["Taxable income", formatMoney(s.taxable)],
                  ...(s.familyReduction ? ([["Family reduction on IUTS", `− ${formatMoney(s.familyReduction)}`]] as SlipRow[]) : []),
                  ["Employer CNSS (16%)", formatMoney(s.cnssEmployer)],
                  ["Cost to the company", formatMoney(s.employerCost)],
                ]}
              />
            </details>
            </div>
            <DialogFooter className="m-0 flex-wrap gap-2 border-t border-hairline bg-app px-5 py-3">
              <Button asChild className="mr-auto max-sm:mr-0">
                <Link href={`/admin/employees/${e.id}`}>Employee file</Link>
              </Button>
              <Button onClick={() => printPayslip(e, s, month, company)}>
                <PrinterIcon /> Payslip
              </Button>
              {editable ? (
                <Button
                  variant="brand"
                  onClick={() => {
                    if (changed) save(month, e.id, parsed);
                    onClose();
                  }}
                >
                  {changed ? "Save" : "Done"}
                </Button>
              ) : (
                <Button variant="brand" onClick={onClose}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type SlipRow = [label: string, value: string, emphasis?: "strong"];

/** A compact block of payslip lines: 32px rows, the label on the left and the amount on the right. */
function SlipSection({ rows, className }: { rows: SlipRow[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-subtle overflow-hidden rounded-lg border border-hairline", className)}>
      {rows.map(([label, value, emphasis]) => (
        <div key={label} className={cn("flex min-h-8 items-center justify-between gap-4 px-3 py-1.5", emphasis && "bg-app")}>
          <dt className={cn("t-14 min-w-0", emphasis ? "font-medium text-fg" : "text-fg-2")}>{label}</dt>
          <dd className={cn("t-14 shrink-0 text-right tabular-nums", emphasis ? "font-medium text-fg" : "text-table")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const toParsed = (i?: PayrollInput): PayrollInput => ({
  bonus: i?.bonus || undefined,
  overtime15: i?.overtime15 || undefined,
  overtime35: i?.overtime35 || undefined,
  absenceDays: i?.absenceDays || undefined,
  note: i?.note?.trim() || undefined,
});

function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cnss, iuts, time } = PAYROLL_RULES;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-5 sm:max-w-[520px]">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="t-16">Payroll rules used</DialogTitle>
          <DialogDescription className="t-14">Burkina Faso, private sector. Set in src/lib/payroll.ts.</DialogDescription>
        </DialogHeader>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">CNSS · confirmed</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Employee {pct(cnss.employee)}; employer {pct(cnss.employer.pension + cnss.employer.family + cnss.employer.workAccidents)} (pension{" "}
            {pct(cnss.employer.pension)}, family benefits {pct(cnss.employer.family)}, work accidents {pct(cnss.employer.workAccidents)}), on the
            whole gross salary up to {formatMoney(cnss.ceiling)} a month.
          </p>
        </section>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">IUTS · to verify</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Taxable income = gross − the exempt part of allowances − employee CNSS − a flat deduction of {pct(iuts.abatement.staff)} of base salary (
            {pct(iuts.abatement.executive)} for executives), rounded down to the hundred. Family reduction: {iuts.familyReduction.slice(1).map(pct).join(" / ")} of the
            tax for 1 / 2 / 3 / 4+ dependents.
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
          <p className="t-14 leading-[1.45] text-fg-2">
            Not taxed:{" "}
            {ALLOWANCES.filter((a) => iuts.exempt[a.kind])
              .map((a) => {
                const r = iuts.exempt[a.kind]!;
                return `${a.label.toLowerCase()} allowance up to ${pct(r.share)} of base salary (at most ${formatMoney(r.cap)})`;
              })
              .join("; ")}
            . Other allowances, overtime and bonuses are taxed in full.
          </p>
        </section>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">Overtime and absence · to verify</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Hourly rate = base salary ÷ {time.monthlyHours} hours (40-hour week). Overtime is paid at +{pct(time.overtime.first)} or +{pct(time.overtime.beyond)}. Each
            unpaid day takes off base salary ÷ {time.daysPerMonth}.
          </p>
        </section>
        <section className="grid gap-1.5">
          <h3 className="t-14 text-fg">Salary advances</h3>
          <p className="t-14 leading-[1.45] text-fg-2">
            Withheld from the net salary in the instalment set on the employee file, oldest advance first, never more than the net. CNSS and IUTS are
            not affected.
          </p>
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
