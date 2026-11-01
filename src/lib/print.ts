/** Escape text for an HTML document. */
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** "4 mars 2023", and "1er novembre 2026" for the first of the month */
export function frenchDate(iso: string) {
  const text = new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return text.startsWith("1 ") ? `1er ${text.slice(2)}` : text;
}

/** "novembre 2026" from "2026-11" */
export function frenchMonth(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** "1 234 567" with a narrow no-break space, as printed on French documents */
export const frenchAmount = (n: number) => Math.round(n).toLocaleString("fr-FR");

const BASE_CSS = `
  @page { size: A4; margin: 18mm; }
  body { font: 14px/1.5 Georgia, "Times New Roman", serif; color: #111; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  .muted { color: #555; font-size: 12px; }
  @media print { .noprint { display: none; } body { margin: 0 auto; } }
`;

/**
 * Open a printable French document in a new tab and bring up the print dialog, so it can be
 * printed or saved as PDF. `body` must already be escaped.
 */
export function openPrintable(title: string, body: string, css = "") {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${BASE_CSS}${css}</style></head>
<body>${body}
<p class="noprint muted" style="margin-top:40px">Imprimez ou enregistrez en PDF (Ctrl/Cmd + P).</p>
<script>window.addEventListener("load", () => window.print());</script>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
