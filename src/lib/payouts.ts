import type { Payslip } from "./payroll";
import type { Employee, PayoutMethod } from "./types";

/**
 * How salaries reach employees. Wave, Orange Money and PI-SPI (the BCEAO's instant payment
 * system, reached through the company's bank or payment provider) take a list of payments in
 * one go; this app prepares that list, it does not move money itself.
 */
export const PAYOUT_METHODS: Record<
  PayoutMethod,
  { label: string; french: string; kind: "mobile" | "alias" | "bank" | "none"; accountLabel: string; placeholder: string }
> = {
  wave: { label: "Wave", french: "Wave", kind: "mobile", accountLabel: "Wave number", placeholder: "+226 70 00 00 00" },
  "orange-money": { label: "Orange Money", french: "Orange Money", kind: "mobile", accountLabel: "Orange Money number", placeholder: "+226 07 00 00 00" },
  "pi-spi": { label: "PI-SPI", french: "PI-SPI", kind: "alias", accountLabel: "PI-SPI alias", placeholder: "Phone number or account alias" },
  bank: { label: "Bank transfer", french: "Virement bancaire", kind: "bank", accountLabel: "Account number (RIB / IBAN)", placeholder: "BF00 0000 0000 0000 0000 0000 000" },
  cash: { label: "Cash or cheque", french: "Espèces ou chèque", kind: "none", accountLabel: "", placeholder: "" },
};

export const PAYOUT_ORDER: PayoutMethod[] = ["wave", "orange-money", "pi-spi", "bank", "cash"];

/** Methods paid from a file sent to the provider, as opposed to by hand. */
export const isBatch = (m: PayoutMethod) => PAYOUT_METHODS[m].kind !== "none";

const COUNTRY = "226";

/**
 * A Burkina Faso mobile number as "+22670123456", or null if it isn't one: 8 digits, with or
 * without the country code, spaces and punctuation ignored.
 */
export function normalizeMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith(COUNTRY)) digits = digits.slice(3);
  return digits.length === 8 ? `+${COUNTRY}${digits}` : null;
}

/** Why a payout account can't be used, or null when it's fine. */
export function payoutError(method: PayoutMethod, account: string): string | null {
  const { kind } = PAYOUT_METHODS[method];
  const value = account.trim();
  if (kind === "none") return null;
  if (!value) return `Enter the ${PAYOUT_METHODS[method].accountLabel.toLowerCase()}.`;
  if (kind === "mobile" && !normalizeMobile(value)) return "Enter an 8-digit Burkina Faso mobile number.";
  if (kind === "bank" && value.replace(/\s/g, "").length < 10) return "That account number looks too short.";
  return null;
}

/** The account as the provider expects it: mobile numbers in international form, the rest trimmed. */
export function payoutAccount(method: PayoutMethod, account: string) {
  const value = account.trim();
  if (PAYOUT_METHODS[method].kind === "mobile") return normalizeMobile(value) ?? value;
  // A PI-SPI alias is often a phone number too
  if (PAYOUT_METHODS[method].kind === "alias") return normalizeMobile(value) ?? value;
  return value.replace(/\s+/g, " ");
}

export type PayoutLine = { employee: Employee; amount: number; account: string };
export type PayoutBatch = { method: PayoutMethod; lines: PayoutLine[]; total: number };

/**
 * A month's salaries grouped by how they're paid, in a fixed order. Employees with no usable
 * payout details fall under "cash" so nobody is left out of the total. Nothing-to-pay lines
 * (a net fully taken by an advance) are skipped.
 */
export function payoutBatches(staff: Employee[], lines: Record<string, Pick<Payslip, "toPay">>): PayoutBatch[] {
  const by = new Map<PayoutMethod, PayoutLine[]>();
  for (const e of staff) {
    const amount = lines[e.id]?.toPay ?? 0;
    if (amount <= 0) continue;
    const usable = e.payout && !payoutError(e.payout.method, e.payout.account);
    const method: PayoutMethod = usable ? e.payout!.method : "cash";
    const account = usable ? payoutAccount(method, e.payout!.account) : "";
    by.set(method, [...(by.get(method) ?? []), { employee: e, amount, account }]);
  }
  return PAYOUT_ORDER.filter((m) => by.has(m)).map((method) => {
    const list = by.get(method)!;
    return { method, lines: list, total: list.reduce((n, l) => n + l.amount, 0) };
  });
}

/** Employees paid by hand only because their payout details are missing or invalid. */
export function missingPayout(staff: Employee[], lines: Record<string, Pick<Payslip, "toPay">>) {
  return staff.filter((e) => (lines[e.id]?.toPay ?? 0) > 0 && (!e.payout || (e.payout.method !== "cash" && !!payoutError(e.payout.method, e.payout.account))));
}

/**
 * The payment list for one batch as CSV rows: recipient, amount in whole FCFA, name and a
 * reference. Providers each have their own upload template; this generic layout carries the
 * same four facts and may need its columns renamed to match (not verified against any of them).
 */
export function batchFileRows(batch: PayoutBatch, month: string, company: string): (string | number)[][] {
  const reference = `Salaire ${month} ${company}`.trim();
  const recipient = PAYOUT_METHODS[batch.method].kind === "bank" ? "Compte" : PAYOUT_METHODS[batch.method].kind === "alias" ? "Alias" : "Numéro";
  return [
    [recipient, "Montant (FCFA)", "Nom", "Motif"],
    ...batch.lines.map((l): (string | number)[] => [l.account, l.amount, l.employee.name, reference]),
    ["Total", batch.total, `${batch.lines.length} paiement${batch.lines.length === 1 ? "" : "s"}`, ""],
  ];
}

export const batchFileName = (method: PayoutMethod, month: string) => `paiement-${method}-${month}.csv`;
