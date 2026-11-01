"use client";

import { useState } from "react";
import { HandCoinsIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addMonths, formatLong, monthName } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { advanceSchedule, repaidBefore } from "@/lib/payroll";
import type { Employee } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { Card, CardHeader, EmptyState } from "@/components/pages/shared/page-chrome";

const monthLabel = (month: string) => `${monthName(month + "-01")} ${month.slice(0, 4)}`;

/**
 * Salary advances for one employee: what's been lent, repaid so far (from validated payroll
 * months) and what's left, plus a way to give a new one.
 */
export function AdvancesCard({ employee: e, today, canAdd }: { employee: Employee; today: string; canAdd: boolean }) {
  const all = useAppStore((s) => s.advances);
  const runs = useAppStore((s) => s.payrollRuns);
  const remove = useAppStore((s) => s.removeAdvance);
  const [adding, setAdding] = useState(false);
  const mine = all.filter((a) => a.employeeId === e.id);
  // Everything withheld in validated or paid months so far
  const repaid = repaidBefore(runs, e.id, "9999-12");
  const { rows } = advanceSchedule(mine, repaid, today.slice(0, 7));
  const outstanding = rows.reduce((n, r) => n + r.remaining, 0);

  return (
    <Card>
      <CardHeader
        title="Salary advances"
        description={mine.length ? (outstanding ? `${formatMoney(outstanding)} still to repay` : "All repaid") : "Money lent against future salary"}
        actions={
          canAdd ? (
            <Button variant="ghost" size="sm" className="h-9 px-3" onClick={() => setAdding(true)}>
              <PlusIcon /> Give an advance
            </Button>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<HandCoinsIcon />} title="No advances" hint="Advances are withheld from the net salary in monthly instalments." />
      ) : (
        <ul className="divide-y divide-subtle">
          {rows.map(({ advance: a, paid, remaining }) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-14 text-fg tabular-nums">
                  {formatMoney(a.amount)}
                  <span className="text-fg-2"> · given {formatLong(a.date)}</span>
                </span>
                <span className="t-12 text-fg-2">
                  {formatMoney(a.installment)} a month from {monthLabel(a.firstMonth)}
                  {a.note ? ` · ${a.note}` : ""}
                </span>
                <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden>
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round((paid / a.amount) * 100)}%` }} />
                </span>
              </div>
              <span className="t-14 w-32 shrink-0 text-right tabular-nums">
                {remaining ? formatMoney(remaining) : "Repaid"}
                <span className="t-12 block text-fg-2">{remaining ? "left" : formatMoney(paid)}</span>
              </span>
              {paid === 0 ? (
                <Button variant="ghost" size="icon" aria-label={`Remove the ${formatMoney(a.amount)} advance`} onClick={() => remove(a.id)}>
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <AdvanceDialog open={adding} employee={e} today={today} onClose={() => setAdding(false)} />
    </Card>
  );
}

function AdvanceDialog({ open, employee: e, today, onClose }: { open: boolean; employee: Employee; today: string; onClose: () => void }) {
  const add = useAppStore((s) => s.addAdvance);
  const runs = useAppStore((s) => s.payrollRuns);
  // Repay from the first month whose payroll is still a draft
  let first = today.slice(0, 7);
  while (runs[first]) first = addMonths(first + "-01", 1).slice(0, 7);
  const blank = { amount: "", installment: "", date: today, firstMonth: first, note: "" };
  const [draft, setDraft] = useState(blank);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(blank);
  }
  const set = (k: keyof typeof blank, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const amount = Number(draft.amount);
  const installment = Number(draft.installment);
  const amountOk = Number.isInteger(amount) && amount > 0;
  const installmentOk = Number.isInteger(installment) && installment > 0 && (!amountOk || installment <= amount);
  const closedMonth = !!runs[draft.firstMonth];
  const valid = amountOk && installmentOk && !!draft.date && !!draft.firstMonth && !closedMonth;
  const months = amountOk && installmentOk ? Math.ceil(amount / installment) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="gap-5 p-5 sm:max-w-[480px]">
        <form
          className="contents"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!valid) return;
            add({ employeeId: e.id, amount, installment, date: draft.date, firstMonth: draft.firstMonth, note: draft.note.trim() || undefined });
            onClose();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">Give {e.name} an advance</DialogTitle>
            <DialogDescription className="t-14">Paid out now and withheld from their net salary each month until repaid.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (FCFA)" htmlFor="adv-amount" error={draft.amount && !amountOk ? "A whole amount above zero." : null}>
              <Input id="adv-amount" type="number" inputMode="numeric" min={1} step={1} className="tabular-nums" value={draft.amount} onChange={(ev) => set("amount", ev.target.value)} />
            </Field>
            <Field
              label="Withheld each month (FCFA)"
              htmlFor="adv-installment"
              error={draft.installment && !installmentOk ? "Above zero and no more than the amount." : null}
              hint={months ? `Repaid in ${months} ${months === 1 ? "month" : "months"}` : undefined}
            >
              <Input
                id="adv-installment"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="tabular-nums"
                value={draft.installment}
                onChange={(ev) => set("installment", ev.target.value)}
              />
            </Field>
            <Field label="Given on" htmlFor="adv-date">
              <Input id="adv-date" type="date" value={draft.date} onChange={(ev) => set("date", ev.target.value)} />
            </Field>
            <Field label="First repayment" htmlFor="adv-first" error={closedMonth ? `${monthLabel(draft.firstMonth)} payroll is already validated.` : null}>
              <Input id="adv-first" type="month" value={draft.firstMonth} onChange={(ev) => set("firstMonth", ev.target.value)} />
            </Field>
            <Field label="Note" htmlFor="adv-note" hint="Optional" className="sm:col-span-2">
              <Input id="adv-note" placeholder="e.g. School fees" value={draft.note} onChange={(ev) => set("note", ev.target.value)} />
            </Field>
          </div>
          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!valid}>
              Record advance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
