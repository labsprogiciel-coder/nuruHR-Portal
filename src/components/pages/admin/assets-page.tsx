"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckIcon, PackageOpenIcon, PlusIcon, SearchIcon, SearchXIcon, UndoIcon, UserRoundIcon, UserRoundPlusIcon, WrenchIcon } from "lucide-react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatShort } from "@/lib/dates";
import { plural } from "@/lib/leave";
import { formatMoney } from "@/lib/money";
import type { Asset } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { AddAssetDialog, AssetRow, AssetStatusBadge, AssignAssetDialog } from "@/components/assets/shared";
import { Card, EmptyState, PageHeader, PageRoot, StatGrid, StatTile } from "@/components/pages/shared/page-chrome";
import { useTeam } from "./shared";

type Filter = "all" | Asset["status"] | "attention";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in-use", label: "In use" },
  { value: "in-stock", label: "In stock" },
  { value: "in-repair", label: "In repair" },
  { value: "attention", label: "Problems" },
];
const needsAttention = (a: Asset) => !!a.issue || a.status === "in-repair";

export function AssetsPage() {
  const assets = useAppStore((s) => s.assets);
  const { employees, byId } = useTeam();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<Asset | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: assets.length, "in-use": 0, "in-stock": 0, "in-repair": 0, attention: 0 };
    for (const a of assets) {
      c[a.status] += 1;
      if (needsAttention(a)) c.attention += 1;
    }
    return c;
  }, [assets]);
  const totalValue = assets.reduce((n, a) => n + a.value, 0);

  // Small list: the React Compiler memoizes this, no useMemo needed.
  const q = query.trim().toLowerCase();
  const rows = assets
    .filter((a) => (filter === "all" ? true : filter === "attention" ? needsAttention(a) : a.status === filter))
    .filter((a) => {
      if (!q) return true;
      const holder = a.employeeId ? byId.get(a.employeeId)?.name : "";
      return [a.name, a.identifier, a.category, holder].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return (
    <PageRoot>
      <PageHeader
        title="Equipment"
        description={`${plural(assets.length, "item", "items")} · ${formatMoney(totalValue)} at purchase`}
        actions={
          <Button variant="brand" onClick={() => setAdding(true)}>
            <PlusIcon /> Add equipment
          </Button>
        }
      />

      <div className="grid gap-4 p-4 md:gap-5 md:p-5">
        <StatGrid>
          <StatTile icon="per-year" label="In use" value={counts["in-use"]} hint={`Held by ${plural(new Set(assets.map((a) => a.employeeId).filter(Boolean)).size, "person", "people")}`} />
          <StatTile icon="available" label="In stock" value={counts["in-stock"]} hint="Ready to hand out" />
          <StatTile icon="pending" label="Needs attention" value={counts.attention} hint={`${counts["in-repair"]} in repair · ${counts.attention - counts["in-repair"]} reported by staff`} />
          <StatTile icon="upcoming" label="Value in use" value={formatMoney(assets.filter((a) => a.status === "in-use").reduce((n, a) => n + a.value, 0), undefined, { compact: true })} hint="Purchase value of assigned items" />
        </StatGrid>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="scroll-thin min-w-0 max-md:w-full max-md:overflow-x-auto">
              <TabsList className="h-9">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="t-14 salt h-8 gap-1.5 px-2.5 text-[14px] data-active:text-fg">
                    {f.label}
                    <span className="t-12 text-placeholder tabular-nums">{counts[f.value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative ml-auto max-md:ml-0 max-md:w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-icon" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search model, serial, person"
                aria-label="Search equipment"
                className="h-9 w-64 pl-8 max-md:h-10 max-md:w-full max-md:text-[16px]"
              />
            </div>
          </div>

          {rows.length === 0 ? (
            query ? (
              <EmptyState icon={<SearchXIcon />} title="Nothing matches" hint="Try another model, serial number or name." />
            ) : (
              <EmptyState icon={<PackageOpenIcon />} title="Nothing here" />
            )
          ) : (
            <ul className="divide-y divide-subtle">
              {rows.map((a) => {
                const holder = a.employeeId ? byId.get(a.employeeId) : undefined;
                return (
                  <AssetRow
                    key={a.id}
                    asset={a}
                    meta={
                      holder ? (
                        <Link href={`/admin/employees/${holder.id}`} className="text-fg hover-fine:underline">
                          {holder.name}
                          {a.assignedOn ? ` · since ${formatShort(a.assignedOn)}` : ""}
                        </Link>
                      ) : null
                    }
                    trailing={
                      <>
                        <span className="t-14 w-32 text-right text-table tabular-nums max-md:hidden">{formatMoney(a.value)}</span>
                        <AssetStatusBadge asset={a} />
                        <AssetActions asset={a} onAssign={() => setAssigning(a)} />
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <AddAssetDialog open={adding} onClose={() => setAdding(false)} />
      <AssignAssetDialog asset={assigning} employees={employees} onClose={() => setAssigning(null)} />
    </PageRoot>
  );
}

/** Admin actions on one asset; reused on the employee file. */
export function AssetActions({ asset: a, onAssign }: { asset: Asset; onAssign: () => void }) {
  const assign = useAppStore((s) => s.assignAsset);
  const toRepair = useAppStore((s) => s.sendAssetToRepair);
  const resolve = useAppStore((s) => s.resolveAssetIssue);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${a.name}`} className="max-md:size-10">
          <Icon name="more" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onAssign}>
          <UserRoundPlusIcon /> {a.employeeId ? "Reassign…" : "Assign to someone…"}
        </DropdownMenuItem>
        {a.employeeId ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/admin/employees/${a.employeeId}`}>
                <UserRoundIcon /> Open holder’s file
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => assign(a.id, null)}>
              <UndoIcon /> Return to stock
            </DropdownMenuItem>
          </>
        ) : null}
        {a.status !== "in-repair" ? (
          <DropdownMenuItem onSelect={() => toRepair(a.id)}>
            <WrenchIcon /> Send to repair
          </DropdownMenuItem>
        ) : null}
        {a.issue || a.status === "in-repair" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => resolve(a.id)}>
              <CheckIcon /> {a.status === "in-repair" ? "Back from repair" : "Mark problem solved"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
