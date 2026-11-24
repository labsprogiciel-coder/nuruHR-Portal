import { toast } from "sonner";
import type { DocCategory, DocumentFile } from "@/lib/types";

export const CATEGORIES: DocCategory[] = ["Contract", "Payslip", "Policy", "Medical", "Tax", "Other"];

/** Larger files are listed but their content isn't kept: browser storage holds about 5 MB in all. */
export const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-guess category from the file name. */
export function guessCategory(name: string, fallback: DocCategory): DocCategory {
  const n = name.toLowerCase();
  if (/payslip|pay slip|salary|wage|bulletin/.test(n)) return "Payslip";
  if (/contract|contrat|agreement|offer|nda/.test(n)) return "Contract";
  if (/policy|handbook|guideline/.test(n)) return "Policy";
  if (/medical|certificate|sick|doctor|health/.test(n)) return "Medical";
  if (/tax|fiscal|impot|impôt|iuts|p60|w-?2|1099|invoice|facture/.test(n)) return "Tax";
  return fallback;
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function downloadDoc(doc: DocumentFile) {
  if (!doc.dataUrl) {
    toast("This is a demo file", { description: `“${doc.name}” has no content attached — upload your own to download it.` });
    return;
  }
  const a = document.createElement("a");
  a.href = doc.dataUrl;
  a.download = doc.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type PreviewKind = "image" | "pdf" | "text" | "none";

/**
 * How a stored file can be shown. Only images, PDFs and plain text are rendered: anything
 * that could run script (HTML, SVG opened as a document) is never loaded into the page.
 */
export function previewKind(doc: Pick<DocumentFile, "dataUrl">): PreviewKind {
  const mime = /^data:([^;,]*)/.exec(doc.dataUrl ?? "")?.[1]?.toLowerCase() ?? "";
  if (!doc.dataUrl) return "none";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain" || mime === "text/csv" || mime === "text/markdown") return "text";
  return "none";
}
