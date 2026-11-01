"use client";

import { useState } from "react";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { computePayslip } from "@/lib/payroll";
import { ME } from "@/lib/team";
import type { ContractType, Employee } from "@/lib/types";
import { useToday } from "@/hooks/use-today";
import { useAppStore } from "@/stores/app-store";

export const CONTRACTS: { value: ContractType; label: string }[] = [
  { value: "CDI", label: "Permanent (CDI)" },
  { value: "CDD", label: "Fixed-term (CDD)" },
  { value: "Apprentice", label: "Apprentice" },
  { value: "Intern", label: "Intern" },
];

type Draft = {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  location: string;
  manager: string;
  startDate: string;
  contract: ContractType;
  contractEnd: string;
  trialEnd: string;
  monthlySalary: string;
  executive: boolean;
  dependents: string;
  cnssNumber: string;
  carryoverDays: string;
};

function toDraft(e: Employee | undefined, today: string): Draft {
  return {
    name: e?.name ?? "",
    email: e?.email ?? "",
    phone: e?.phone ?? "",
    jobTitle: e?.jobTitle ?? "",
    department: e?.department ?? "",
    location: e?.location ?? "",
    manager: e?.manager ?? "",
    startDate: e?.startDate ?? today,
    contract: e?.contract ?? "CDI",
    contractEnd: e?.contractEnd ?? "",
    trialEnd: e?.trialEnd ?? "",
    monthlySalary: e ? String(e.monthlySalary) : "",
    executive: !!e?.executive,
    dependents: String(e?.dependents ?? 0),
    cnssNumber: e?.cnssNumber ?? "",
    carryoverDays: String(e?.carryoverDays ?? 0),
  };
}

/** What's wrong with each field, if anything. Dates are YYYY-MM-DD, so they compare as strings. */
function problems(d: Draft) {
  const salary = Number(d.monthlySalary);
  const dependents = Number(d.dependents);
  const carryover = Number(d.carryoverDays);
  const fixedTerm = d.contract !== "CDI";
  return {
    name: d.name.trim() ? null : "Enter their full name.",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) ? null : "Enter a valid email address.",
    jobTitle: d.jobTitle.trim() ? null : "Enter their job title.",
    department: d.department.trim() ? null : "Enter a department.",
    location: d.location.trim() ? null : "Enter an office or site.",
    startDate: d.startDate ? null : "Pick a start date.",
    contractEnd: !fixedTerm
      ? null
      : !d.contractEnd
        ? "A fixed-term contract needs an end date."
        : d.contractEnd <= d.startDate
          ? "The end date must be after the start date."
          : null,
    trialEnd:
      d.trialEnd && d.trialEnd < d.startDate
        ? "The trial can't end before the start date."
        : d.trialEnd && fixedTerm && d.contractEnd && d.trialEnd > d.contractEnd
          ? "The trial can't end after the contract."
          : null,
    monthlySalary: Number.isInteger(salary) && salary > 0 ? null : "Enter the gross monthly salary in FCFA.",
    dependents: Number.isInteger(dependents) && dependents >= 0 && dependents <= 20 ? null : "Between 0 and 20.",
    carryoverDays: Number.isFinite(carryover) && carryover >= 0 && carryover <= 60 ? null : "Between 0 and 60 days.",
  };
}

/**
 * Add someone to the team, or edit their file. Department, office and manager suggest what's
 * already in use so the lists stay consistent.
 */
export function EmployeeDialog({
  open,
  employee,
  team,
  onClose,
  onAdded,
}: {
  open: boolean;
  /** Edit this employee; add a new one when undefined */
  employee?: Employee;
  /** Everyone on file, for the suggestions */
  team: Employee[];
  onClose: () => void;
  onAdded?: (id: string) => void;
}) {
  const today = useToday();
  const add = useAppStore((s) => s.addEmployee);
  const update = useAppStore((s) => s.updateEmployee);
  const [draft, setDraft] = useState<Draft>(() => toDraft(employee, today));
  const [showErrors, setShowErrors] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Start from the right record each time the dialog opens (setState during render, React's
  // pattern for resetting state from props).
  const key = open ? (employee?.id ?? "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setDraft(toDraft(employee, today));
      setShowErrors(false);
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const errors = problems(draft);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);
  const valid = Object.values(errors).every((e) => !e);
  const fixedTerm = draft.contract !== "CDI";

  const salary = Number(draft.monthlySalary);
  const net =
    Number.isInteger(salary) && salary > 0
      ? computePayslip({ monthlySalary: salary, dependents: Math.min(20, Math.max(0, Number(draft.dependents) || 0)), executive: draft.executive }).net
      : null;

  const others = team.filter((e) => e.id !== employee?.id);
  const suggestions = {
    departments: [...new Set(team.map((e) => e.department))].sort(),
    locations: [...new Set(team.map((e) => e.location))].sort(),
    managers: [...new Set([...others.map((e) => e.name), ...team.map((e) => e.manager)])].sort(),
  };

  const submit = () => {
    setShowErrors(true);
    if (!valid) return;
    const record = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      jobTitle: draft.jobTitle.trim(),
      department: draft.department.trim(),
      location: draft.location.trim(),
      manager: draft.manager.trim(),
      startDate: draft.startDate,
      contract: draft.contract,
      contractEnd: fixedTerm ? draft.contractEnd : undefined,
      trialEnd: draft.trialEnd || undefined,
      monthlySalary: salary,
      executive: draft.executive,
      dependents: Number(draft.dependents),
      cnssNumber: draft.cnssNumber.trim(),
      carryoverDays: Number(draft.carryoverDays),
    };
    if (employee) {
      update(employee.id, record);
      onClose();
    } else {
      const id = add(record);
      onClose();
      onAdded?.(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-[640px]">
        <form
          className="contents"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">{employee ? `Edit ${employee.name}` : "Add an employee"}</DialogTitle>
            <DialogDescription className="t-14">
              {employee?.id === ME
                ? "This is your own file: name, contact and job details also update your profile."
                : employee
                  ? "Changes apply from now on; months already validated in payroll keep their payslips."
                  : "They join the team list, leave balances and payroll from their start month."}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-4">
            <legend className="t-14 mb-3 font-medium text-fg">Identity</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="emp-name" error={err("name")} className="sm:col-span-2">
                <Input id="emp-name" autoComplete="off" placeholder="e.g. Fatimata Sawadogo" value={draft.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!err("name")} />
              </Field>
              <Field label="Work email" htmlFor="emp-email" error={err("email")}>
                <Input id="emp-email" type="email" autoComplete="off" placeholder="name@company.bf" value={draft.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!err("email")} />
              </Field>
              <Field label="Phone" htmlFor="emp-phone">
                <Input id="emp-phone" type="tel" autoComplete="off" placeholder="+226 70 00 00 00" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="t-14 mb-3 font-medium text-fg">Job</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title" htmlFor="emp-title" error={err("jobTitle")}>
                <Input id="emp-title" placeholder="e.g. Accountant" value={draft.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} aria-invalid={!!err("jobTitle")} />
              </Field>
              <Field label="Department" htmlFor="emp-dept" error={err("department")}>
                <Input id="emp-dept" list="emp-depts" value={draft.department} onChange={(e) => set("department", e.target.value)} aria-invalid={!!err("department")} />
              </Field>
              <Field label="Office or site" htmlFor="emp-location" error={err("location")}>
                <Input id="emp-location" list="emp-locations" value={draft.location} onChange={(e) => set("location", e.target.value)} aria-invalid={!!err("location")} />
              </Field>
              <Field label="Reports to" htmlFor="emp-manager" hint="Leave empty if they report to no one here.">
                <Input id="emp-manager" list="emp-managers" value={draft.manager} onChange={(e) => set("manager", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="t-14 mb-3 font-medium text-fg">Contract and pay</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contract" htmlFor="emp-contract">
                <Select value={draft.contract} onValueChange={(v) => set("contract", v as ContractType)}>
                  <SelectTrigger id="emp-contract" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACTS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start date" htmlFor="emp-start" error={err("startDate")}>
                <Input id="emp-start" type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!err("startDate")} />
              </Field>
              {fixedTerm ? (
                <Field label="Contract ends" htmlFor="emp-end" error={err("contractEnd")}>
                  <Input id="emp-end" type="date" min={draft.startDate} value={draft.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} aria-invalid={!!err("contractEnd")} />
                </Field>
              ) : null}
              <Field label="Trial period ends" htmlFor="emp-trial" error={err("trialEnd")} hint="Optional · période d'essai">
                <Input id="emp-trial" type="date" min={draft.startDate} value={draft.trialEnd} onChange={(e) => set("trialEnd", e.target.value)} aria-invalid={!!err("trialEnd")} />
              </Field>
              <Field
                label="Gross monthly salary (FCFA)"
                htmlFor="emp-salary"
                error={err("monthlySalary")}
                hint={net !== null ? `About ${formatMoney(net)} net a month after CNSS and IUTS` : undefined}
              >
                <Input
                  id="emp-salary"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="0"
                  className="tabular-nums"
                  value={draft.monthlySalary}
                  onChange={(e) => set("monthlySalary", e.target.value)}
                  aria-invalid={!!err("monthlySalary")}
                />
              </Field>
              <Field label="Dependents" htmlFor="emp-dependents" error={err("dependents")} hint="Lowers IUTS (up to 4 count)">
                <Input
                  id="emp-dependents"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  step={1}
                  className="tabular-nums"
                  value={draft.dependents}
                  onChange={(e) => set("dependents", e.target.value)}
                  aria-invalid={!!err("dependents")}
                />
              </Field>
              <Field label="CNSS number" htmlFor="emp-cnss" hint="Leave empty until it's issued">
                <Input id="emp-cnss" className="font-mono" value={draft.cnssNumber} onChange={(e) => set("cnssNumber", e.target.value)} />
              </Field>
              <Field
                label="Leave carried over (days)"
                htmlFor="emp-carryover"
                error={err("carryoverDays")}
                hint={employee?.id === ME ? "Your own carryover is set in Settings." : undefined}
              >
                <Input
                  id="emp-carryover"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={60}
                  step={0.5}
                  className="tabular-nums"
                  value={draft.carryoverDays}
                  disabled={employee?.id === ME}
                  onChange={(e) => set("carryoverDays", e.target.value)}
                  aria-invalid={!!err("carryoverDays")}
                />
              </Field>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox id="emp-executive" checked={draft.executive} onCheckedChange={(v) => set("executive", v === true)} className="mt-0.5" />
              <Label htmlFor="emp-executive" className="t-14 grid gap-0.5 font-normal text-fg">
                Executive staff (cadre)
                <span className="t-12 text-fg-2">Gets the 20% flat deduction in IUTS instead of 25%.</span>
              </Label>
            </div>
          </fieldset>

          <datalist id="emp-depts">
            {suggestions.departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <datalist id="emp-locations">
            {suggestions.locations.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <datalist id="emp-managers">
            {suggestions.managers.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            {showErrors && !valid ? <p className="t-12 mr-auto self-center text-danger">Check the highlighted fields.</p> : null}
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand">
              {employee ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
