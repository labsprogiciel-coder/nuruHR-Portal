"use client";

import { useState } from "react";
import {
  CarIcon,
  LaptopIcon,
  MotorbikeIcon,
  PackageIcon,
  SmartphoneIcon,
  TabletIcon,
  type LucideIcon,
} from "lucide-react";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatLong } from "@/lib/dates";
import type { Asset, AssetCategory, EventColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-today";
import { useAppStore } from "@/stores/app-store";

export const ASSET_CATEGORIES: AssetCategory[] = ["Laptop", "Phone", "Tablet", "Vehicle", "Motorbike", "Other"];

const CATEGORY_STYLE: Record<AssetCategory, { icon: LucideIcon; color: EventColor }> = {
  Laptop: { icon: LaptopIcon, color: "blue" },
  Phone: { icon: SmartphoneIcon, color: "green" },
  Tablet: { icon: TabletIcon, color: "cyan" },
  Vehicle: { icon: CarIcon, color: "orange" },
  Motorbike: { icon: MotorbikeIcon, color: "pink" },
  Other: { icon: PackageIcon, color: "purple" },
};

/** Category glyph on its tint, in the same style as the payout-method tiles. */
export function AssetIcon({ category, className }: { category: AssetCategory; className?: string }) {
  const { icon: Glyph, color } = CATEGORY_STYLE[category];
  return (
    <span
      aria-hidden
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", className)}
      style={{ background: `var(--category-${color}-tint)`, color: `var(--event-${color}-fg)` }}
    >
      <Glyph className="size-4" strokeWidth={2} />
    </span>
  );
}

const STATUS: Record<Asset["status"] | "issue", { label: string; tone: string }> = {
  "in-use": { label: "In use", tone: "success" },
  "in-stock": { label: "In stock", tone: "neutral" },
  "in-repair": { label: "In repair", tone: "warning" },
  issue: { label: "Problem reported", tone: "danger" },
};

/** In use / In stock / In repair, or "Problem reported" while an issue is open on an asset in use. */
export function AssetStatusBadge({ asset, className }: { asset: Asset; className?: string }) {
  const { label, tone } = STATUS[asset.issue && asset.status === "in-use" ? "issue" : asset.status];
  return (
    <span
      className={cn("t-12 inline-flex h-[22px] shrink-0 items-center rounded-[6px] border px-1.5 whitespace-nowrap", className)}
      style={{
        background: `var(--status-${tone}-tint)`,
        borderColor: `var(--status-${tone}-border)`,
        color: `var(--status-${tone})`,
      }}
    >
      {label}
    </span>
  );
}

/** Icon, make and model, identifier; `meta` and `trailing` slots for the page-specific bits. */
export function AssetRow({
  asset,
  meta,
  trailing,
  className,
}: {
  asset: Asset;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("flex min-h-16 items-center gap-3 px-4 py-2.5 max-sm:flex-wrap", className)}>
      <AssetIcon category={asset.category} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="t-14 truncate text-fg">{asset.name}</span>
        <span className="t-12 truncate text-fg-2">
          {asset.category} · {asset.identifier}
          {meta ? <> · {meta}</> : null}
        </span>
        {asset.issue ? <span className="t-12 line-clamp-2 text-danger">{asset.issue.note}</span> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">{trailing}</div> : null}
    </li>
  );
}

export const heldSince = (a: Asset) => (a.assignedOn ? `since ${formatLong(a.assignedOn)}` : null);

/* ------------------------------------------------------------------ dialogs */

/** Employee: describe what's wrong with something they hold. */
export function ReportIssueDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const report = useAppStore((s) => s.reportAssetIssue);
  const [note, setNote] = useState("");
  const close = () => {
    setNote("");
    onClose();
  };
  return (
    <Dialog
      open={!!asset}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="gap-5 p-5 sm:max-w-[440px]">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!asset || !note.trim()) return;
            report(asset.id, note.trim());
            close();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">Report a problem</DialogTitle>
            <DialogDescription className="t-14">
              {asset ? `${asset.name} · ${asset.identifier}. ` : null}HR sees this on the equipment list.
            </DialogDescription>
          </DialogHeader>
          <Field label="What's wrong?" htmlFor="asset-issue">
            <Textarea
              id="asset-issue"
              rows={3}
              autoFocus
              required
              placeholder="e.g. The battery doesn't hold a charge for more than an hour"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            <Button type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!note.trim()}>
              Send to HR
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Admin: pick who gets an asset. */
export function AssignAssetDialog({
  asset,
  employees,
  onClose,
}: {
  asset: Asset | null;
  employees: { id: string; name: string; jobTitle: string }[];
  onClose: () => void;
}) {
  const assign = useAppStore((s) => s.assignAsset);
  const [employeeId, setEmployeeId] = useState("");
  const close = () => {
    setEmployeeId("");
    onClose();
  };
  return (
    <Dialog open={!!asset} onOpenChange={(v) => !v && close()}>
      <DialogContent className="gap-5 p-5 sm:max-w-[420px]">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!asset || !employeeId) return;
            assign(asset.id, employeeId);
            close();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">Assign {asset?.name}</DialogTitle>
            <DialogDescription className="t-14">
              {asset?.employeeId ? "It moves from its current holder to the person you pick." : "It leaves stock and is registered to the person you pick."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Employee" htmlFor="asset-holder">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="asset-holder" className="w-full">
                <SelectValue placeholder="Choose someone" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.id !== asset?.employeeId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} <span className="text-fg-2">· {e.jobTitle}</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            <Button type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!employeeId}>
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Admin: register a new piece of equipment; it starts in stock. */
export function AddAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAppStore((s) => s.addAsset);
  const today = useToday();
  // purchasedOn stays empty until edited and falls back to today.
  const blank = { category: "Laptop" as AssetCategory, name: "", identifier: "", value: "", purchasedOn: "" };
  const [draft, setDraft] = useState(blank);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const value = Number(draft.value);
  const valid = draft.name.trim() && draft.identifier.trim() && Number.isInteger(value) && value >= 0;
  const close = () => {
    setDraft(blank);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="gap-5 p-5 sm:max-w-[480px]">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            add({
              category: draft.category,
              name: draft.name.trim(),
              identifier: draft.identifier.trim(),
              value,
              purchasedOn: draft.purchasedOn || today,
              condition: "New",
            });
            close();
          }}
        >
          <DialogHeader className="gap-1.5">
            <DialogTitle className="t-16">Add equipment</DialogTitle>
            <DialogDescription className="t-14">It goes into stock; assign it to someone from the list.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="asset-category">
              <Select value={draft.category} onValueChange={(v) => set("category", v as AssetCategory)}>
                <SelectTrigger id="asset-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Make and model" htmlFor="asset-name">
              <Input id="asset-name" required placeholder="e.g. Dell Latitude 5440" value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Serial, IMEI or plate" htmlFor="asset-identifier">
              <Input id="asset-identifier" required placeholder="e.g. SN 5CG3301XZT" value={draft.identifier} onChange={(e) => set("identifier", e.target.value)} />
            </Field>
            <Field label="Purchase value (FCFA)" htmlFor="asset-value">
              <Input
                id="asset-value"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                required
                placeholder="0"
                className="tabular-nums"
                value={draft.value}
                onChange={(e) => set("value", e.target.value)}
              />
            </Field>
            <Field label="Purchase date" htmlFor="asset-date">
              <Input id="asset-date" type="date" required value={draft.purchasedOn || today} onChange={(e) => set("purchasedOn", e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
            <Button type="button" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!valid}>
              Add to stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
