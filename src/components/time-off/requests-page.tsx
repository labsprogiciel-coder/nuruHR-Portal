"use client";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";
import { plural } from "@/lib/leave";
import { useAppStore } from "@/stores/app-store";
import { openOverlay } from "@/stores/overlay-store";
import { useRequestFilters } from "@/stores/request-filters-store";
import { RequestsTable } from "./requests-table";

/** The signed-in employee's leave requests, on their own page next to the Time off calendar. */
export function RequestsPage() {
  const requests = useAppStore((s) => s.requests);
  const filters = useRequestFilters((s) => s.filters);
  const setFilters = useRequestFilters((s) => s.setFilters);
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <PageRoot className="bg-surface">
      <PageHeader
        title="Leave requests"
        description={
          requests.length
            ? `${plural(requests.length, "request", "requests")} · ${pending ? `${pending} awaiting approval` : "none awaiting approval"}`
            : "Nothing requested yet"
        }
        actions={
          <Button variant="brand" onClick={() => openOverlay({ kind: "request" })}>
            <Icon name="request-time-off" className="text-on-accent" /> Request time-off
          </Button>
        }
      />
      <RequestsTable filters={filters} onFiltersChange={setFilters} />
    </PageRoot>
  );
}
