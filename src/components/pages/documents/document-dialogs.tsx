"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, FileIcon, FileWarningIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLong } from "@/lib/dates";
import type { DocCategory, DocumentFile } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { CATEGORIES, downloadDoc, formatSize, guessCategory, MAX_INLINE_BYTES, previewKind, readAsDataUrl } from "./document-utils";

type Pending = { key: string; file: File; category: DocCategory };

/**
 * Review files before they are saved: pick each one's category (pre-filled from its name) and
 * see which are too large to keep, instead of finding out from a toast afterwards.
 */
export function UploadDialog({
  files,
  fallback,
  onClose,
  onUploaded,
}: {
  /** The files just chosen or dropped; null keeps the dialog closed */
  files: File[] | null;
  fallback: DocCategory;
  onClose: () => void;
  onUploaded: () => void;
}) {
  return (
    <Dialog open={!!files?.length} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-[560px]">
        {files?.length ? <UploadForm files={files} fallback={fallback} onClose={onClose} onUploaded={onUploaded} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ files, fallback, onClose, onUploaded }: { files: File[]; fallback: DocCategory; onClose: () => void; onUploaded: () => void }) {
  const addDocument = useAppStore((s) => s.addDocument);
  const [items, setItems] = useState<Pending[]>(() =>
    files.map((file, i) => ({ key: `${i}-${file.name}`, file, category: guessCategory(file.name, fallback) })),
  );
  const [saving, setSaving] = useState(false);
  const tooLarge = items.filter((i) => i.file.size > MAX_INLINE_BYTES).length;

  async function save() {
    setSaving(true);
    for (const { file, category } of items) {
      let dataUrl: string | undefined;
      if (file.size <= MAX_INLINE_BYTES) {
        try {
          dataUrl = await readAsDataUrl(file);
        } catch {
          dataUrl = undefined;
        }
      }
      addDocument({ name: file.name, category, size: file.size, dataUrl, starred: false });
    }
    toast.success(items.length === 1 ? "Document uploaded" : `${items.length} documents uploaded`, {
      description: items.length === 1 ? `${items[0].file.name} · ${items[0].category}` : undefined,
    });
    onUploaded();
    onClose();
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (items.length && !saving) void save();
      }}
    >
      <DialogHeader className="gap-1.5">
        <DialogTitle className="t-16">Upload {items.length === 1 ? "1 file" : `${items.length} files`}</DialogTitle>
        <DialogDescription className="t-14">Check where each file goes. You can move them later.</DialogDescription>
      </DialogHeader>

      <ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-hairline">
        {items.map((item) => {
          const large = item.file.size > MAX_INLINE_BYTES;
          return (
            <li key={item.key} className="flex items-center gap-3 px-3 py-2.5 max-sm:flex-wrap">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-app text-icon">
                {large ? <FileWarningIcon className="size-4 text-warning" /> : <FileIcon className="size-4" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-14 truncate text-fg" title={item.file.name}>
                  {item.file.name}
                </span>
                <span className="t-12 text-fg-2">
                  {formatSize(item.file.size)}
                  {large ? " · too large to keep, only its details are saved" : ""}
                </span>
              </span>
              <Select
                value={item.category}
                onValueChange={(v) => setItems((list) => list.map((x) => (x.key === item.key ? { ...x, category: v as DocCategory } : x)))}
              >
                <SelectTrigger className="h-9 w-[124px] max-sm:h-10 max-sm:flex-1" aria-label={`Category for ${item.file.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 max-sm:size-10"
                aria-label={`Don't upload ${item.file.name}`}
                onClick={() => {
                  if (items.length === 1) onClose();
                  else setItems((list) => list.filter((x) => x.key !== item.key));
                }}
              >
                <XIcon />
              </Button>
            </li>
          );
        })}
      </ul>

      {tooLarge ? (
        <p className="t-12 leading-[1.4] text-fg-2">
          {tooLarge === 1 ? "One file is" : `${tooLarge} files are`} over {formatSize(MAX_INLINE_BYTES)}. This demo stores files in your browser, so
          large ones are listed but can&rsquo;t be previewed or downloaded.
        </p>
      ) : null}

      <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={saving}>
          Upload {items.length === 1 ? "file" : `${items.length} files`}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Look at a document without downloading it: images, PDFs and plain text show inline. */
export function PreviewDialog({ doc, onClose }: { doc: DocumentFile | null; onClose: () => void }) {
  return (
    <Dialog open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-5 sm:max-w-[760px]">
        {doc ? <PreviewBody key={doc.id} doc={doc} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ doc, onClose }: { doc: DocumentFile; onClose: () => void }) {
  const kind = previewKind(doc);
  // PDFs and text are read from the stored file once the dialog opens
  const [loaded, setLoaded] = useState<{ url?: string; text?: string; failed?: boolean }>({});

  useEffect(() => {
    if (!doc.dataUrl || (kind !== "pdf" && kind !== "text")) return;
    let url: string | undefined;
    let cancelled = false;
    fetch(doc.dataUrl)
      .then(async (r) => {
        if (kind === "text") {
          const text = await r.text();
          if (!cancelled) setLoaded({ text });
          return;
        }
        const blob = await r.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded({ url });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ failed: true });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.dataUrl, kind]);

  const noPreview = (title: string, hint: string) => (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-hairline bg-app p-6 text-center">
      <FileIcon className="size-6 text-icon" />
      <p className="t-14 text-fg">{title}</p>
      <p className="t-12 max-w-[36em] leading-[1.4] text-fg-2">{hint}</p>
    </div>
  );

  return (
    <>
      <DialogHeader className="min-w-0 gap-1.5 pr-8">
        <DialogTitle className="t-16 truncate" title={doc.name}>
          {doc.name}
        </DialogTitle>
        <DialogDescription className="t-14">
          {doc.category} · {formatSize(doc.size)} · added {formatLong(doc.uploadedAt.slice(0, 10))}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 overflow-auto">
        {!doc.dataUrl ? (
          noPreview(
            "Nothing to preview",
            doc.size > MAX_INLINE_BYTES
              ? "This file was too large to keep in the browser, so only its details were saved."
              : "This is a demo file with no content attached. Upload your own to preview it.",
          )
        ) : loaded.failed ? (
          noPreview("This file couldn't be opened", "Download it to view it in another app.")
        ) : kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL from this browser; nothing for the image optimiser to do
          <img src={doc.dataUrl} alt={doc.name} className="mx-auto max-h-[62dvh] max-w-full rounded-lg border border-hairline object-contain" />
        ) : kind === "pdf" ? (
          loaded.url ? (
            <iframe src={loaded.url} title={doc.name} className="h-[62dvh] w-full rounded-lg border border-hairline bg-app" />
          ) : (
            <div className="h-[62dvh] w-full animate-pulse rounded-lg border border-hairline bg-app" aria-label="Loading preview" />
          )
        ) : kind === "text" ? (
          <pre className="t-12 max-h-[62dvh] overflow-auto rounded-lg border border-hairline bg-app p-3 font-mono leading-[1.5] whitespace-pre-wrap text-fg">
            {loaded.text ?? ""}
          </pre>
        ) : (
          noPreview("No preview for this kind of file", "Download it to open it in another app.")
        )}
      </div>

      <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
        <Button type="button" onClick={onClose}>
          Close
        </Button>
        {doc.dataUrl ? (
          <Button type="button" variant="brand" onClick={() => downloadDoc(doc)}>
            <DownloadIcon /> Download
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
