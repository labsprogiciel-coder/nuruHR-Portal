"use client";

import { create } from "zustand";
import { LEAVE_TYPES } from "@/lib/leave";
import type { LeaveStatus, LeaveType } from "@/lib/types";

export const ALL_STATUSES: LeaveStatus[] = ["approved", "pending", "declined", "cancelled"];

export type RequestFilters = { statuses: LeaveStatus[]; types: LeaveType[] };
export const DEFAULT_FILTERS: RequestFilters = { statuses: ALL_STATUSES, types: LEAVE_TYPES };

/**
 * Filters of the Leave requests page. Kept in a store so other pages can open it already
 * filtered (the calendar's "pending requests" stat, the dashboard).
 */
export const useRequestFilters = create<{ filters: RequestFilters; setFilters: (f: RequestFilters) => void }>()((set) => ({
  filters: DEFAULT_FILTERS,
  setFilters: (filters) => set({ filters }),
}));

export const showPendingRequests = () => useRequestFilters.getState().setFilters({ ...DEFAULT_FILTERS, statuses: ["pending"] });
