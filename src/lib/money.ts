/** Workspace currency: the West African CFA franc (UEMOA), used in Burkina Faso. */
export const DEFAULT_CURRENCY = "XOF";

/** Currencies offered in pickers, CFA first. XAF is the Central African CFA franc. */
export const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "GHS", "NGN"] as const;

const CFA = new Set(["XOF", "XAF"]);
// fr-FR groups thousands with a narrow no-break space: 1 250 000
const cfaNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
// For big totals in tight spots: 21 575 000 → "21,6 M"
const cfaCompact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * "1 250 000 FCFA" for CFA francs (no minor unit, so always whole francs);
 * other currencies use their usual symbol, e.g. "€1,250.00".
 */
export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  { whole = false, compact = false } = {},
): string {
  if (CFA.has(currency)) return `${(compact ? cfaCompact : cfaNumber).format(Math.round(amount))} FCFA`;
  const key = `${currency}:${whole}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency, ...(whole && { maximumFractionDigits: 0 }) });
    formatters.set(key, f);
  }
  return f.format(amount);
}

/** Smallest amount step for inputs: whole francs for CFA, cents otherwise. */
export const moneyStep = (currency: string) => (CFA.has(currency) ? 1 : 0.01);
