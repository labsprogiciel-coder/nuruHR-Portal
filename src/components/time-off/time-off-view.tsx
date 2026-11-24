"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "@/components/calendar/calendar";
import { useCalendarStore } from "@/stores/calendar-store";
import { showPendingRequests } from "@/stores/request-filters-store";
import { StatsPanel } from "./stats-panel";

/** The leave calendar with the balance beside it. Requests have their own page (Leave requests). */
export function TimeOffView() {
  const router = useRouter();

  return (
    <div
      data-page-scroll
      onScroll={() => useCalendarStore.getState().popover && useCalendarStore.getState().closePopover()}
      className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      {/* The calendar header shows the month; this names the page */}
      <h1 className="sr-only">Time off</h1>
      {/* xl+: calendar and stats side by side, filling the page. Below: stats stack under the calendar. */}
      <div className="flex w-full shrink-0 flex-col xl:h-full xl:min-h-[520px] xl:flex-row xl:overflow-hidden">
        <div className="flex h-[max(460px,calc(100dvh_-_72px))] w-full shrink-0 md:h-[max(560px,calc(100dvh_-_140px))] xl:h-full xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink">
          <Calendar />
        </div>
        <StatsPanel
          onShowPending={() => {
            showPendingRequests();
            router.push("/time-off/requests");
          }}
        />
      </div>
    </div>
  );
}
