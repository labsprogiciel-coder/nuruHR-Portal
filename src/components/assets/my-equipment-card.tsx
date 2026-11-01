"use client";

import { useMemo, useState } from "react";
import { MessageSquareWarningIcon, PackageOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ME } from "@/lib/team";
import type { Asset } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { Card, CardHeader, EmptyState } from "@/components/pages/shared/page-chrome";
import { AssetRow, AssetStatusBadge, heldSince, ReportIssueDialog } from "./shared";

/** Employee view: the company equipment registered to you, with a way to report a problem. */
export function MyEquipmentCard() {
  const assets = useAppStore((s) => s.assets);
  const mine = useMemo(() => assets.filter((a) => a.employeeId === ME), [assets]);
  const [reporting, setReporting] = useState<Asset | null>(null);

  return (
    <Card>
      <CardHeader
        title="My equipment"
        description={mine.length ? "Company property registered to you. Return it when you leave." : "Company property registered to you"}
      />
      {mine.length === 0 ? (
        <EmptyState icon={<PackageOpenIcon />} title="Nothing assigned" hint="Laptops, phones or vehicles HR gives you show up here." />
      ) : (
        <ul className="divide-y divide-subtle">
          {mine.map((a) => (
            <AssetRow
              key={a.id}
              asset={a}
              meta={heldSince(a)}
              trailing={
                a.issue ? (
                  <AssetStatusBadge asset={a} />
                ) : (
                  <Button size="sm" className="max-sm:h-10 max-sm:flex-1" onClick={() => setReporting(a)}>
                    <MessageSquareWarningIcon className="text-icon" /> Report a problem
                  </Button>
                )
              }
            />
          ))}
        </ul>
      )}
      <ReportIssueDialog asset={reporting} onClose={() => setReporting(null)} />
    </Card>
  );
}
