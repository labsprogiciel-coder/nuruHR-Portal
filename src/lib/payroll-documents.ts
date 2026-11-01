import { ALLOWANCES, PAYROLL_RULES, type Payslip } from "./payroll";
import { escapeHtml, frenchAmount, frenchMonth, openPrintable } from "./print";
import type { Employee } from "./types";

const pct = (n: number) => `${String(Math.round(n * 1000) / 10).replace(".", ",")} %`;

/** A CSV file the browser downloads. Text that a spreadsheet would run as a formula is neutralised. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v));
  const csv = rows.map((r) => r.map((v) => `"${cell(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

type Line = [label: string, amount: number];

/**
 * The French payslip (bulletin de paie) for one employee and month: earnings, employee
 * deductions, net, advance repayment and net to pay, then the employer's contributions.
 */
export function printPayslip(e: Employee, s: Payslip, month: string, company: string) {
  const { cnss, iuts } = PAYROLL_RULES;
  const earnings: Line[] = [
    ["Salaire de base", s.base],
    ...ALLOWANCES.filter((a) => s.allowances[a.kind]).map((a): Line => [a.french, s.allowances[a.kind]!]),
    ...(s.overtime ? ([["Heures supplémentaires", s.overtime]] as Line[]) : []),
    ...(s.bonus ? ([["Prime", s.bonus]] as Line[]) : []),
    ...(s.absence ? ([["Retenue pour absence non rémunérée", -s.absence]] as Line[]) : []),
  ];
  const deductions: Line[] = [
    [`Cotisation CNSS salariale (${pct(cnss.employee)})`, s.cnssEmployee],
    [`IUTS${s.familyReduction ? ` (après réduction pour charges de famille de ${frenchAmount(s.familyReduction)})` : ""}`, s.iuts],
  ];
  const employerRate = cnss.employer.pension + cnss.employer.family + cnss.employer.workAccidents;
  const row = ([label, amount]: Line) => `<tr><td>${escapeHtml(label)}</td><td class="n">${amount < 0 ? "−" : ""}${frenchAmount(Math.abs(amount))}</td></tr>`;

  const body = `
  <header>
    <div><strong>${escapeHtml(company)}</strong></div>
    <div class="right"><h1>BULLETIN DE PAIE</h1><div>Période : ${escapeHtml(frenchMonth(month))}</div></div>
  </header>
  <table class="who">
    <tr><td>Salarié(e)</td><td><strong>${escapeHtml(e.name)}</strong></td><td>N° CNSS</td><td>${escapeHtml(e.cnssNumber || "—")}</td></tr>
    <tr><td>Emploi</td><td>${escapeHtml(e.jobTitle)} (${escapeHtml(e.department)})</td><td>Catégorie</td><td>${e.executive ? "Cadre" : "Non-cadre"}</td></tr>
    <tr><td>Contrat</td><td>${escapeHtml(e.contract)}</td><td>Personnes à charge</td><td>${e.dependents}</td></tr>
  </table>
  <table>
    <thead><tr><th>Éléments de rémunération</th><th class="n">Montant (FCFA)</th></tr></thead>
    <tbody>${earnings.map(row).join("")}</tbody>
    <tfoot><tr><td>Salaire brut</td><td class="n">${frenchAmount(s.gross)}</td></tr></tfoot>
  </table>
  <table>
    <thead><tr><th>Retenues salariales</th><th class="n">Montant (FCFA)</th></tr></thead>
    <tbody>${deductions.map(row).join("")}</tbody>
    <tfoot>
      <tr><td>Salaire net</td><td class="n">${frenchAmount(s.net)}</td></tr>
      ${s.advance ? `<tr class="plain"><td>Remboursement d'avance sur salaire</td><td class="n">−${frenchAmount(s.advance)}</td></tr>` : ""}
      <tr class="total"><td>Net à payer</td><td class="n">${frenchAmount(s.toPay)}</td></tr>
    </tfoot>
  </table>
  <table class="small">
    <thead><tr><th>Charges patronales</th><th class="n">Montant (FCFA)</th></tr></thead>
    <tbody>
      <tr><td>CNSS patronale (${pct(employerRate)}) sur ${frenchAmount(s.cnssBase)}</td><td class="n">${frenchAmount(s.cnssEmployer)}</td></tr>
      <tr><td>Coût total employeur</td><td class="n">${frenchAmount(s.employerCost)}</td></tr>
    </tbody>
  </table>
  <p class="muted">Base imposable IUTS : ${frenchAmount(s.taxable)} FCFA (brut − part exonérée des indemnités ${frenchAmount(s.exempt)} − CNSS − abattement forfaitaire de ${pct(e.executive ? iuts.abatement.executive : iuts.abatement.staff)} sur le salaire de base).
  ${iuts.verified ? "" : "Barème IUTS et exonérations à confirmer avec votre comptable."}</p>
  <p class="muted">À conserver sans limitation de durée.</p>`;

  openPrintable(
    `Bulletin de paie – ${e.name} – ${frenchMonth(month)}`,
    body,
    `header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  h1 { font-size: 18px; letter-spacing: 1px; margin: 0 0 4px; }
  .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f3f3f3; font-weight: bold; }
  .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { font-weight: bold; }
  tfoot tr.plain td { font-weight: normal; }
  tr.total td { font-size: 16px; border-top: 2px solid #111; }
  .who td { border: none; padding: 3px 8px 3px 0; }
  .who td:nth-child(odd) { color: #555; width: 18%; }
  .small { font-size: 13px; }`,
  );
}

/** Monthly CNSS return: each employee's contribution base (capped) and the contributions. */
export function cnssDeclarationRows(staff: Employee[], lines: Record<string, Payslip>): (string | number)[][] {
  const { cnss } = PAYROLL_RULES;
  const rows: (string | number)[][] = [
    ["Nom", "N° CNSS", "Salaire brut", "Assiette plafonnée", "Part salariale", "Pension (patronale)", "Prestations familiales", "Accidents du travail", "Total cotisations"],
  ];
  let total = 0;
  for (const e of staff) {
    const s = lines[e.id];
    const pension = Math.round(s.cnssBase * cnss.employer.pension);
    const family = Math.round(s.cnssBase * cnss.employer.family);
    const accidents = s.cnssEmployer - pension - family;
    const sum = s.cnssEmployee + s.cnssEmployer;
    total += sum;
    rows.push([e.name, e.cnssNumber, s.gross, s.cnssBase, s.cnssEmployee, pension, family, accidents, sum]);
  }
  rows.push(["Total", "", "", "", "", "", "", "", total]);
  return rows;
}

/** Monthly IUTS return: from gross to tax withheld, per employee. */
export function iutsDeclarationRows(staff: Employee[], lines: Record<string, Payslip>): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["Nom", "Catégorie", "Charges de famille", "Salaire brut", "Part exonérée", "CNSS salariale", "Abattement", "Revenu imposable", "IUTS brut", "Réduction familiale", "IUTS retenu"],
  ];
  let total = 0;
  for (const e of staff) {
    const s = lines[e.id];
    total += s.iuts;
    rows.push([e.name, e.executive ? "Cadre" : "Non-cadre", e.dependents, s.gross, s.exempt, s.cnssEmployee, s.abatement, s.taxable, s.iutsBeforeReduction, s.familyReduction, s.iuts]);
  }
  rows.push(["Total", "", "", "", "", "", "", "", "", "", total]);
  return rows;
}
