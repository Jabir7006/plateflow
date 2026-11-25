"use client"

import { useQuery } from "@tanstack/react-query"
import { getDashboardSummary } from "../api"

export const dashboardSummaryKey = ["dashboard", "summary"] as const

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryKey,
    queryFn: getDashboardSummary,
    staleTime: 30_000,
    // Backstop socket updates and pick up menu availability changes made by
    // another staff member even while this tab stays open.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}
