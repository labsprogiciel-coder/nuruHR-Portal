"use client";

import { useState } from "react";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { yearsOfService } from "@/lib/labour-code";
import { formatDays, plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import type { Asset, DepartureReason, Employee } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";

export const DEPARTURE_REASONS: DepartureReason[] = ["Resignation", "End of contract", "Dismissal", "Mutual agreement", "Retirement", "Other"];

/**
 * Record that someone is leaving: their last day, why, and what to settle. The leave payout is
 * an estimate on a 30-day month; the final settlement (solde de tout compte) is for HR to confirm.
 */
export function DepartureDialog({
  open,
  employee: e,
  leaveLeft,
  assets,
  today,
  onClose,
}: {
  open: boolean;
  employee: Employee;
  /** Annual leave days not taken */
  leaveLeft: number;
  /** What they still hold */
  assets: Asset[];
  today: string;
  onClose: () => void;
}) {
  const record = useAppStore((s) => s.recordDeparture);
  const fixedTermEnding = !!e.contractEnd && e.contractEnd >= today;
  const initial = { date: fixedTermEnding ? e.contractEnd! : today, reason: (fixedTermEnding ? "End of contract" : "Resignation") as DepartureReason, note: "" };
  const [draft, setDraft] = useState(initial);
  const [returnAssets, setReturnAssets] = useState(true);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(initial);
      setReturnAssets(true);
    }
  }

  const dateError = !draft.date ? "Pick their last day." : draft.date < e.startDate ? "Their last day can't be before they started." : null;
  const years = yearsOfService(e.startDate, draft.date || today);
  const days = Math.max(0, leaveLeft);
  const payout = Math.round((days * e.monthlySalary) / 30);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-[520px]">
        <form
          className="contents"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (dateError) return;
            record(e.id, { date: draft.date, reason: draft.reason, note: draft.note.trim() || undefined }, returnAssets);
            onClose();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">Record {e.name}&rsquo;s departure</DialogTitle>
            <DialogDescription className="t-14">
              They stay on the team until their last day, then move to former employees. Their file, payslips and history are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Last day worked" htmlFor="dep-date" error={dateError}>
              <Input id="dep-date" type="date" min={e.startDate} value={draft.date} onChange={(ev) => setDraft((d) => ({ ...d, date: ev.target.value }))} aria-invalid={!!dateError} />
            </Field>
            <Field label="Reason" htmlFor="dep-reason">
              <Select value={draft.reason} onValueChange={(v) => setDraft((d) => ({ ...d, reason: v as DepartureReason }))}>
                <SelectTrigger id="dep-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTURE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note" htmlFor="dep-note" hint="Optional · only HR sees it" className="sm:col-span-2">
              <Textarea id="dep-note" rows={2} value={draft.note} onChange={(ev) => setDraft((d) => ({ ...d, note: ev.target.value }))} />
            </Field>
          </div>

          <section aria-label="To settle" className="grid gap-3 rounded-lg border border-hairline bg-app p-3.5">
            <p className="t-14 font-medium text-fg">To settle</p>
            <dl className="t-14 grid gap-2">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-2">Time at the company</dt>
                <dd className="text-fg">{years ? plural(years, "year", "years") : "Less than a year"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-2">Leave not taken</dt>
                <dd className="text-right text-fg tabular-nums">
                  {formatDays(days)} {days === 1 ? "day" : "days"}
                  {days > 0 ? <span className="t-12 block text-fg-2">≈ {formatMoney(payout)} leave pay, at salary ÷ 30</span> : null}
                </dd>
              </div>
            </dl>
            {assets.length ? (
              <div className="grid gap-2 border-t border-hairline pt-3">
                <div className="flex items-start gap-2.5">
                  <Checkbox id="dep-assets" checked={returnAssets} onCheckedChange={(v) => setReturnAssets(v === true)} className="mt-0.5" />
                  <Label htmlFor="dep-assets" className="t-14 grid gap-0.5 font-normal text-fg">
                    Mark their equipment as returned
                    <span className="t-12 text-fg-2">{assets.map((a) => a.name).join(", ")}</span>
                  </Label>
                </div>
              </div>
            ) : null}
            <p className="t-12 leading-[1.4] text-fg-2">
              Check the final settlement (solde de tout compte) with your accountant: notice, severance and the exact leave pay depend on the contract and the
              Labour Code.
            </p>
          </section>

          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!!dateError}>
              Record departure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "4 mars 2023", and "1er novembre 2026" for the first of the month */
function frenchDate(iso: string) {
  const text = new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return text.startsWith("1 ") ? `1er ${text.slice(2)}` : text;
}

/**
 * The work certificate (certificat de travail) the employer hands over at the end of a contract:
 * who, which job, from when to when. Opens in a new tab ready to print or save as PDF.
 */
export function printWorkCertificate(e: Employee, company: string, today: string) {
  if (!e.departure) return;
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Certificat de travail – ${escape(e.name)}</title>
<style>
  @page { size: A4; margin: 25mm; }
  body { font: 15px/1.6 Georgia, "Times New Roman", serif; color: #111; max-width: 640px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: 20px; letter-spacing: 2px; text-align: center; margin: 48px 0 40px; }
  .company { font-weight: bold; }
  .sign { margin-top: 64px; text-align: right; }
  .muted { color: #555; font-size: 13px; }
  @media print { .noprint { display: none; } body { margin: 0 auto; } }
</style></head>
<body>
  <p class="company">${escape(company)}</p>
  <h1>CERTIFICAT DE TRAVAIL</h1>
  <p>Nous soussignés, ${escape(company)}, certifions que <strong>${escape(e.name)}</strong> a été employé(e) au sein de notre entreprise
  du <strong>${frenchDate(e.startDate)}</strong> au <strong>${frenchDate(e.departure.date)}</strong>, en qualité de <strong>${escape(e.jobTitle)}</strong>
  (service ${escape(e.department)}).</p>
  <p>${escape(e.name)} nous quitte libre de tout engagement.</p>
  <p>Ce certificat est délivré pour servir et valoir ce que de droit.</p>
  <p class="sign">Fait à ${escape(e.location)}, le ${frenchDate(today)}<br><br>La Direction<br><span class="muted">(signature et cachet)</span></p>
  <p class="noprint muted" style="margin-top:48px">Imprimez ou enregistrez en PDF (Ctrl/Cmd + P), puis faites signer et tamponner.</p>
  <script>window.addEventListener("load", () => window.print());</script>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
