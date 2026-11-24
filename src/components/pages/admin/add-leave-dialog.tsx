"use client";

import { useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatShort } from "@/lib/dates";
import { DEDUCTED } from "@/lib/labour-code";
import { countedDays, formatDays, LEAVE_COLORS, LEAVE_TYPES, overlappingRequest, plural, type LeaveStats } from "@/lib/leave";
import type { Employee, LeaveType, TeamRequest } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

// Full days only: part-day leave is requested by the employee, with its hours
const TYPES = LEAVE_TYPES.filter((t) => t !== "Half-day leave");

/**
 * HR records leave for someone: a paper form, a phone call, or staff who don't use the app.
 * It is saved as approved, since HR is the one deciding. Pass `employee` to fix who it's for;
 * otherwise the dialog asks.
 */
export function AddLeaveDialog({
  open,
  employee,
  employees,
  requests,
  stats,
  today,
  from,
  onClose,
}: {
  open: boolean;
  employee?: Employee;
  /** Who can be picked when `employee` isn't given */
  employees: Employee[];
  /** Everyone's requests, to catch overlaps */
  requests: TeamRequest[];
  stats: Map<string, LeaveStats>;
  today: string;
  /** Start date to open on (a day clicked in the calendar) */
  from?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-[480px]">
        {open ? (
          <AddLeaveForm employee={employee} employees={employees} requests={requests} stats={stats} start={from ?? today} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddLeaveForm({
  employee,
  employees,
  requests,
  stats,
  start,
  onClose,
}: {
  employee?: Employee;
  employees: Employee[];
  requests: TeamRequest[];
  stats: Map<string, LeaveStats>;
  start: string;
  onClose: () => void;
}) {
  const record = useAppStore((s) => s.recordLeave);
  const holidays = useAppStore((s) => s.holidays);
  const [who, setWho] = useState(employee?.id ?? "");
  const [type, setType] = useState<LeaveType>("Annual leave");
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(start);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const person = employee ?? employees.find((e) => e.id === who);
  const days = from && to >= from ? countedDays(type, from, to, holidays).length : 0;
  const clash = person && from && to >= from ? overlappingRequest(requests.filter((r) => r.employeeId === person.id), { from, to, allDay: true }) : undefined;
  const errors = {
    who: person ? null : "Choose who the leave is for.",
    dates: !from || !to
      ? "Pick the first and last day."
      : to < from
        ? "The last day must be on or after the first."
        : days === 0
          ? "These dates fall on weekends or holidays, so there is nothing to record."
          : clash
            ? `${person!.name.split(" ")[0]} already has ${clash.type.toLowerCase()} ${clash.status === "approved" ? "approved" : "awaiting approval"} for ${
                clash.from === clash.to ? formatShort(clash.from) : `${formatShort(clash.from)} – ${formatShort(clash.to)}`
              }.`
            : null,
  };
  const valid = !errors.who && !errors.dates;
  const available = person ? stats.get(person.id)?.available : undefined;
  const over = DEDUCTED[type] && available !== undefined && days > available;

  return (
    <form
      className="contents"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!valid || !person) return setShowErrors(true);
        if (record(person.id, { type, from, to, notes })) onClose();
      }}
    >
      <DialogHeader className="gap-1.5">
        <DialogTitle className="t-16">{employee ? `Add leave for ${employee.name}` : "Add leave"}</DialogTitle>
        <DialogDescription className="t-14">Recorded as approved, in full days. Use it for paper forms or staff without the app.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {employee ? null : (
          <Field label="Employee" htmlFor="al-who" error={showErrors ? errors.who : null} className="sm:col-span-2">
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger id="al-who" className="w-full" aria-invalid={showErrors && !!errors.who}>
                <SelectValue placeholder="Choose an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Leave type" htmlFor="al-type" className="sm:col-span-2">
          <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
            <SelectTrigger id="al-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="size-2 rounded-full" style={{ background: `var(--event-${LEAVE_COLORS[t]}-fg)` }} />
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="First day" htmlFor="al-from">
          <Input
            id="al-from"
            type="date"
            value={from}
            onChange={(ev) => {
              setFrom(ev.target.value);
              if (to < ev.target.value) setTo(ev.target.value);
            }}
          />
        </Field>
        <Field label="Last day" htmlFor="al-to">
          <Input id="al-to" type="date" min={from} value={to} onChange={(ev) => setTo(ev.target.value)} />
        </Field>
        <Field label="Note" htmlFor="al-notes" hint="Optional" className="sm:col-span-2">
          <Textarea id="al-notes" rows={2} placeholder="e.g. Paper form signed on Nov 20" value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        </Field>
      </div>

      <div className="grid gap-1.5 rounded-lg border border-hairline bg-app px-3.5 py-3">
        {errors.dates && (showErrors || (from && to)) && errors.dates !== "Pick the first and last day." ? (
          <p className="t-12 flex items-start gap-1.5 text-danger" role="alert">
            <AlertTriangleIcon className="mt-px size-3.5 shrink-0" /> {errors.dates}
          </p>
        ) : (
          <>
            <p className="t-14 text-fg">
              {plural(days, "day", "days")} counted
              <span className="text-fg-2"> · weekends and holidays are left out where the Labour Code says so</span>
            </p>
            {person && available !== undefined ? (
              <p className="t-12 text-fg-2">
                {DEDUCTED[type]
                  ? `${person.name.split(" ")[0]} has ${formatDays(available)} days available; ${formatDays(Math.max(0, available - days))} left after this.`
                  : "Not taken from their annual balance."}
              </p>
            ) : null}
            {over ? (
              <p className="t-12 flex items-start gap-1.5 text-warning">
                <AlertTriangleIcon className="mt-px size-3.5 shrink-0" /> This is more than their balance; the extra days may be unpaid leave.
              </p>
            ) : null}
          </>
        )}
      </div>

      <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="brand">
          Record leave
        </Button>
      </DialogFooter>
    </form>
  );
}
